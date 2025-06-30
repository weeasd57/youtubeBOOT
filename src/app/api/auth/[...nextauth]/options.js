import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens, supabaseAdmin } from '@/lib/supabase-server';
import { refreshAccessToken } from '@/utils/refreshToken';
import { createClient } from '@supabase/supabase-js';
import { ensureUserExists } from '@/middleware/checkUser';
import { v4 as uuidv4 } from 'uuid'; // Import uuid to generate UUIDs
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { JWT, Session, AdapterUser } from 'next-auth';

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
    async signIn({ user, account, profile }) {
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

        // --- NEW LOGIC: Create or update account entry in public.accounts table ---
        let supabaseAccountId;
        const { data: existingAccount, error: findAccountError } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('owner_id', dbUserId)
          .eq('provider_account_id', profile.sub)
          .single();

        if (findAccountError && findAccountError.code !== 'PGRST116') {
          console.error('Error finding existing account by provider_account_id and owner_id:', findAccountError);
          return false;
        }

        if (existingAccount) {
          supabaseAccountId = existingAccount.id;
          console.log(`[NextAuth] Found existing account for owner ${dbUserId} and Google ID ${profile.sub}. Account ID: ${supabaseAccountId}`);
          // Update last_used_at for existing account
          const { error: updateAccountError } = await supabaseAdmin
            .from('accounts')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', supabaseAccountId);
          if (updateAccountError) {
            console.error('Error updating last_used_at for account:', updateAccountError);
          }
        } else {
          supabaseAccountId = uuidv4(); // Generate UUID for new account
          console.log(`[NextAuth] Creating new account for owner ${dbUserId} and Google ID ${profile.sub}. New Account ID: ${supabaseAccountId}`);
          const { error: insertAccountError } = await supabaseAdmin
            .from('accounts')
            .insert({
              id: supabaseAccountId,
              owner_id: dbUserId,
              provider_account_id: profile.sub,
              name: profile.name,
              email: profile.email,
              image: profile.picture,
              account_type: 'google',
              created_at: new Date().toISOString(),
              last_used_at: new Date().toISOString()
            });
          if (insertAccountError) {
            console.error('Error inserting new account:', insertAccountError);
            return false;
          }
        }
        
        // Pass the supabaseAccountId to the user object for the jwt callback
        user.supabaseAccountId = supabaseAccountId; 

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async jwt({ token, user, account, profile }) {
      // For initial sign-in, user and account will be available
      if (account && user) {
        token.auth_user_id = user.id; // user.id from AdapterUser is the auth.users.id
        
        // --- NEW LOGIC: Save tokens to user_tokens table ---
        // user.supabaseAccountId is set in the signIn callback
        console.log(`[NextAuth JWT Callback] User object:`, user);
        console.log(`[NextAuth JWT Callback] Account object:`, account);
        
        if (user.supabaseAccountId && account.access_token) {
          console.log(`[NextAuth JWT] Saving tokens for user ${user.id} and account ${user.supabaseAccountId}`);
          await saveUserTokens({
            authUserId: user.id,
            accountId: user.supabaseAccountId,
            email: user.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at, // NextAuth provides this in seconds
            providerAccountId: profile.sub // Pass providerAccountId
          });
        } else {
          console.warn(`[NextAuth JWT] Skipped saving tokens. supabaseAccountId: ${user.supabaseAccountId}, access_token present: ${!!account.access_token}`);
          if (!account.refresh_token) {
            console.warn(`[NextAuth JWT] Refresh token was NOT provided by Google during sign-in.`);
          }
        }
      }
      
      // Always try to set active account ID in the token
      // This runs on subsequent requests after initial sign-in
      if (token.auth_user_id) {
        try {
          // Fetch accounts for the user from public.accounts table
          const { data: accounts, error } = await supabaseAdmin
            .from('accounts')
            .select('id, last_used_at') // Select id and last_used_at
            .eq('owner_id', token.auth_user_id)
            .order('last_used_at', { ascending: false, nullsFirst: false }); // Order by most recently used

          if (error) {
            console.error('Error fetching accounts for JWT:', error);
          } else if (accounts && accounts.length > 0) {
            // Choose the active account based on last_used_at or simply the first one
            const activeAccount = accounts[0]; 
            token.active_account_id = activeAccount.id;
            console.log(`[JWT] Set active_account_id: ${activeAccount.id} for user: ${token.auth_user_id}`);
          } else {
            console.log(`[JWT] No accounts found for user: ${token.auth_user_id}, active_account_id not set.`);
            token.active_account_id = null; // Ensure it's null if no accounts
          }
        } catch (e) {
          console.error('Unexpected error in JWT callback fetching accounts:', e);
          token.active_account_id = null; // Set to null on error
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
    signIn: '/',
  },

  secret: process.env.NEXTAUTH_SECRET
};