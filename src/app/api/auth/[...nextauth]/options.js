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
          scope: 'openid profile email https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube',
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
        console.log('JWT callback - Initial sign in', { 
          account_type: account.type,
          scope: account.scope || 'No scope provided' 
        });
        
        // Save user to Supabase when they sign in
        await saveUserToSupabase(user);
        
        // Save tokens to separate table for background access
        if (account.access_token) {
          await saveUserTokens({
            email: user.email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at
          });
        }
        
        return {
          ...token,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        };
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
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.access_token;
      session.refreshToken = token.refresh_token;
      session.expiresAt = token.expires_at;
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