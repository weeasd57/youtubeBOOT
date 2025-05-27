import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens, supabaseAdmin } from '@/utils/supabase-server';

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
    async jwt({ token, account, user, trigger }) {
      // Initial sign in
      if (account && user) {
        console.log('JWT callback - Initial sign in for:', user.email);
        
        try {
          // Save user to Supabase and get their auth_user_id
          const savedUser = await saveUserToSupabase(user);
          if (!savedUser || !savedUser.id) {
            throw new Error('Failed to save or retrieve user data from Supabase');
          }

          // Save tokens and get saved token data
          const savedTokens = await saveUserTokens({
            email: user.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at
          });

          if (!savedTokens || !savedTokens.access_token) {
            throw new Error('Failed to save or retrieve token data');
          }

          // Return the token with all required data
          return {
            ...token,
            auth_user_id: savedUser.id,
            active_account_id: savedUser.active_account_id,
            access_token: savedTokens.access_token,
            refresh_token: savedTokens.refresh_token,
            expires_at: savedTokens.expires_at,
          };
        } catch (error) {
          console.error('JWT callback - Error during initial sign in:', error);
          token.error = error.message;
          // Explicitly remove user IDs on error during initial sign-in
          delete token.auth_user_id;
          delete token.active_account_id;
          return token;
        }
      }
      
      // Handle session updates
      if (trigger === 'update' && token.email) {
        console.log('JWT callback - Session update triggered for:', token.email);
        try {
          // Get fresh user data
          const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, active_account_id')
            .eq('email', token.email)
            .single();

          if (userError || !userData) {
            // If user data fetching fails during update, log and clear user IDs from token
            console.error('JWT callback - Failed to get user data during session update:', userError?.message || 'User data not found');
            token.error = userError?.message || 'User data not found during session update';
            delete token.auth_user_id;
            delete token.active_account_id;
            return token;
          }

          // Update token with fresh user data
          return {
            ...token,
            auth_user_id: userData.id,
            active_account_id: userData.active_account_id,
          };
        } catch (error) {
          console.error('JWT callback - Unexpected error during session update:', error);
          token.error = error.message;
          // Explicitly remove user IDs on unexpected error during update
          delete token.auth_user_id;
          delete token.active_account_id;
          return token;
        }
      }

      // Return existing token if no updates needed
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.access_token;
      session.refreshToken = token.refresh_token;
      session.expiresAt = token.expires_at;
      session.error = token.error;
      session.authUserId = token.auth_user_id;
      session.activeAccountId = token.active_account_id;
      
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.includes('/home')) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/'
  },
  secret: process.env.NEXTAUTH_SECRET
};