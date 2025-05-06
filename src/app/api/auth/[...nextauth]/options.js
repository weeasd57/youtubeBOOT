import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens } from '@/utils/supabase';

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
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
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