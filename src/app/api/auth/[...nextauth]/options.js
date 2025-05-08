import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens } from '@/utils/supabase';
import { supabaseAdmin } from '@/utils/supabase';

// NextAuth configuration options
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        console.log('JWT callback: Initial sign in, saving tokens');
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        
        // Store tokens in database for later use by cron jobs
        if (token.email) {
          await saveUserTokens({
            email: token.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at
          });
        }
      }
      
      // Handle session updates - load fresh token from database when session is updated
      if (trigger === 'update' && token.email) {
        console.log('JWT callback: Session update triggered, checking for fresh tokens');
        try {
          // Get the latest token from the database
          const { data: userTokens, error } = await supabaseAdmin
            .from('user_tokens')
            .select('access_token, refresh_token, expires_at')
            .eq('user_email', token.email)
            .single();
            
          if (userTokens && !error) {
            console.log('JWT callback: Found fresh tokens in database, updating session');
            token.accessToken = userTokens.access_token;
            token.expiresAt = userTokens.expires_at;
            // Only update refresh token if it exists (it might not be returned in some refresh flows)
            if (userTokens.refresh_token) {
              token.refreshToken = userTokens.refresh_token;
            }
          }
        } catch (error) {
          console.error('JWT callback: Error fetching tokens from database:', error);
        }
      }
      
      return token;
    },
    async session({ session, token, user }) {
      // Send properties to the client
      session.accessToken = token.accessToken;
      session.error = token.error;
      
      // Save user data to Supabase
      if (session.user) {
        await saveUserToSupabase(session.user);
      }
      
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Handle redirects
      if (url.startsWith(baseUrl)) return url;
      // If trying to go to home, allow it
      if (url.includes('/home')) return url;
      // Default to the home page
      return baseUrl;
    },
  },
  pages: {
    signIn: '/',
    signOut: '/',
    error: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async signIn({ user, account, profile }) {
      // Save user data to Supabase when they sign in
      if (user) {
        await saveUserToSupabase(user);
        
        // Store tokens for background access
        if (account && user.email) {
          await saveUserTokens({
            email: user.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at
          });
        }
      }
    },
  },
}; 