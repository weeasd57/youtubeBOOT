import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens, supabaseAdmin } from '@/lib/supabase-server';
import { refreshAccessToken } from '@/utils/refreshToken';
import { createClient } from '@supabase/supabase-js';
import { ensureUserExists } from '@/middleware/checkUser';
import { v4 as uuidv4 } from 'uuid'; // Import uuid to generate UUIDs

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
        timeout: 120000, // 120 ثانية (زيادة وقت الاستجابة للمشاكل المتعلقة بالشبكة أو العمليات البطيئة)
      },
      userinfo: {
        params: { fields: 'id,email,name,picture' },
      },
      profile(profile) {
        return {
          id: profile.sub || profile.id, // Keep the original Google ID here
          name: profile.name,
          email: profile.email,
          image: profile.picture
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      try {
        // Find existing user by google_id or create a new UUID for a new user
        let userId = user.id; // This is the Google ID initially

        const { data: existingUser, error: findUserError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('google_id', userId)
          .single();

        if (findUserError && findUserError.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error finding existing user by google_id:', findUserError);
          return false;
        }

        let dbUserId;
        if (existingUser) {
          dbUserId = existingUser.id;
        } else {
          dbUserId = uuidv4(); // Generate a new UUID for new users
        }
        
        // Always try to create/update user
        const { error: userError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: dbUserId, // Use the UUID for the 'id' field
            email: user.email,
            name: user.name,
            avatar_url: user.image,
            google_id: user.id, // Store the original Google ID
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (userError) {
          console.error('Error in signIn - creating/updating user:', userError);
          return false;
        }
        
        // Update the user object with the internal UUID for subsequent callbacks
        user.id = dbUserId; 

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async jwt({ token, account, user }) {
      if (account) {
        // If it's a new sign-in, user will be present. user.id is already the UUID from signIn callback.
        if (user) {
          token.auth_user_id = user.id; // This is the internal UUID
          token.google_id = account.providerAccountId; // Store Google's provider account ID
        } else {
          // If not a new sign-in (e.g., token refresh), try to get auth_user_id from Google ID
          // This ensures that existing sessions still link to the correct internal user ID
          const { data: existingUser, error: findUserError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('google_id', token.google_id)
            .single();

          if (findUserError && findUserError.code !== 'PGRST116') {
            console.error('Error finding existing user by google_id in jwt callback:', findUserError);
            // Decide how to handle this error - maybe return token as is or throw
          } else if (existingUser) {
            token.auth_user_id = existingUser.id;
          }
        }

        try {
          let accountData;
          let accountError;

          // Try to find an existing account for this owner and type
          const { data: existingAccount, error: findAccountError } = await supabaseAdmin
            .from('accounts')
            .select('id')
            .eq('owner_id', token.auth_user_id)
            .eq('account_type', 'google')
            .maybeSingle();

          if (findAccountError && findAccountError.code !== 'PGRST116') { // PGRST116 means no rows found
            console.error('Error finding existing account:', findAccountError);
            throw findAccountError;
          }

          const commonAccountData = {
            name: token.name,
            email: token.email,
            image: token.picture,
            account_type: 'google',
            provider_account_id: account.providerAccountId, // Make sure this is always set
            updated_at: new Date().toISOString()
          };

          if (existingAccount) {
            // Update existing account
            console.log('Updating existing account with ID:', existingAccount.id);
            const { data, error } = await supabaseAdmin
              .from('accounts')
              .update(commonAccountData)
              .eq('id', existingAccount.id)
              .select()
              .single();
            accountData = data;
            accountError = error;
          } else {
            // Insert new account
            console.log('Inserting new account for owner:', token.auth_user_id);
            const { data, error } = await supabaseAdmin
              .from('accounts')
              .insert({
                owner_id: token.auth_user_id,
                ...commonAccountData
              })
              .select()
              .single();
            accountData = data;
            accountError = error;
          }

          if (accountError) {
            console.error('Error creating/updating account:', accountError);
            throw accountError;
          }

          // Save token information
          token.active_account_id = accountData.id;
          token.account = {
            id: accountData.id,
            name: token.name,
            email: token.email,
            image: token.picture,
            account_type: 'google'
          };

          // Save tokens
          if (account.access_token) {
            const savedTokens = await saveUserTokens({
              authUserId: token.auth_user_id,
              accountId: accountData.id,
              email: token.email,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at
            });

            if (savedTokens) {
              token.access_token = savedTokens.access_token;
              token.refresh_token = savedTokens.refresh_token;
              token.expires_at = savedTokens.expires_at;
            }
          }
        } catch (error) {
          console.error('Error in JWT callback:', error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.auth_user_id = token.auth_user_id;
      session.active_account_id = token.active_account_id;
      session.account = token.account;
      return session;
    }
  },

  pages: {
    signIn: '/signin',
  },

  secret: process.env.NEXTAUTH_SECRET
};