import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens, supabaseAdmin } from '@/utils/supabase-server.js';
import { refreshAccessToken } from '@/utils/refreshToken';
import { createClient } from '@supabase/supabase-js';

// NextAuth configuration options
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      },
      httpOptions: {
        timeout: 60000, // 60 ثانية
      },
      userinfo: {
        params: { fields: 'id,email,name,picture' },
      },
      profile(profile) {
        return {
          id: profile.sub || profile.id,
          name: profile.name,
          email: profile.email,
          image: profile.picture
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // This callback is called whenever a JWT is created or updated.
      if (account && user) {
        // Handle sign-in / account linking.
        // On the very first sign-in `token.auth_user_id` will be undefined.
        // For subsequent account additions we should NOT create another row in `users` –
        // we simply reuse the existing authenticated user ID stored on the token.

        const isFirstSignin = !token.auth_user_id;
        const authUserId = isFirstSignin
          ? (await (async () => {
              console.log('JWT Callback: First sign-in for user:', user.email);
              const savedUser = await saveUserToSupabase(user);
              if (!savedUser || !savedUser.id) {
                throw new Error('Failed to save or retrieve user data from public.users');
              }
              return savedUser.id;
            })())
          : token.auth_user_id;

        // Persist the user id on the token so that future callbacks can skip user creation
        token.auth_user_id = authUserId;

        // Step 2: Create or update the specific Google account in the `accounts` table.
        // Try to find if this account already exists for this user
        const { data: existingAccount, error: findError } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('owner_id', authUserId)
          .eq('email', user.email)
          .single();

        let accountId;
        if (!findError && existingAccount) {
          // The account already exists, just use its ID.
          console.log(`Account ${user.email} already exists for user ${authUserId}. Using ID: ${existingAccount.id}`);
          accountId = existingAccount.id;
        } else {
          // The account doesn't exist for this user, so create it.
          // No need to check for "primary" or "active" status.
          const { data: newAccount, error: createError } = await supabaseAdmin
            .from('accounts')
            .insert({
              owner_id: authUserId,
              name: user.name,
              email: user.email,
              image: user.image,
              account_type: 'google'
              // No is_primary field
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating new account:', createError);
            throw new Error('Failed to create new account in public.accounts.');
          }
          console.log(`New account created for ${user.email} with ID: ${newAccount.id}`);
          accountId = newAccount.id;
        }

        // Step 3: Save the tokens to the `user_tokens` table, now with correct IDs.
        const savedTokens = await saveUserTokens({
          authUserId: authUserId,
          accountId: accountId,
          email: user.email, // Keep email for reference, even though we use IDs
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        });

        if (!savedTokens) {
          throw new Error('Failed to save tokens to public.user_tokens');
        }
        
        console.log('Tokens saved successfully for account_id:', accountId);

        // Step 4: Populate the token with necessary info for the session.
        token.access_token = savedTokens.access_token;
        token.refresh_token = savedTokens.refresh_token;
        token.expires_at = savedTokens.expires_at;
        token.active_account_id = accountId; // Still useful for identifying which account is current
        token.account = { // Attach account details to the token for the session callback.
          id: accountId,
          name: user.name,
          email: user.email,
          image: user.image,
          account_type: 'google',
        };

        return token;
      }

      // Return previous token if the access token has not expired yet
      if (token.expires_at && Date.now() < token.expires_at * 1000) {
        return token;
      }
      
      // Access token has expired, try to update it
      console.log("Access token expired, needs refresh. (Refresh logic to be implemented if needed)");
      
      // Make sure the email is available on the token
      if (!token.email) {
        console.error("JWT callback: Token has no email, cannot refresh.");
        return token; // Return original token if email is missing to avoid breaking session
      }

      try {
        const refreshed = await refreshAccessToken(token.email);
        
        if (refreshed.success) {
          console.log("Token refreshed successfully from JWT callback");
          // Update the token with new values
          return {
            ...token,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expires_at: refreshed.expiresAt,
            // Ensure account details persist
            account: token.account,
          };
        } else if (refreshed.needsReauth) {
          console.warn("Token refresh failed due to revoked access, requiring re-authentication.");
          // Invalidate the token to force a sign-out on the client side
          return {
            ...token,
            error: "reauthenticate_required", // Custom error status
            accessToken: null,
            refreshToken: null,
            expires_at: 0,
          };
        } else {
          console.error("Failed to refresh token from JWT callback:", refreshed.error);
          // Return original token if refresh fails to allow user to manually refresh
          return token;
        }
      } catch (refreshError) {
        console.error("Error during token refresh in JWT callback:", refreshError);
        return token; // Return original token on unexpected errors
      }
    },

    async session({ session, token }) {
      // The session callback is called whenever a session is checked.
      // We are passing the custom properties from the JWT to the session object.
      
      // Pass the user's primary ID and active account details to the session
      session.user.id = token.auth_user_id; 
      session.user.auth_user_id = token.auth_user_id;
      session.account = token.account;
      session.active_account_id = token.active_account_id;

      // Pass token details to the session
      session.access_token = token.access_token;
      session.refresh_token = token.refresh_token;
      session.expires_at = token.expires_at;

      return session;
    },

    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/signin', // Custom sign-in page
  },
  secret: process.env.NEXTAUTH_SECRET,
};