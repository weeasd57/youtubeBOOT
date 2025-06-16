import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens, supabaseAdmin } from '@/lib/supabase-server';
import { refreshAccessToken } from '@/utils/refreshToken';
import { createClient } from '@supabase/supabase-js';
import { ensureUserExists } from '@/middleware/checkUser';

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
    async signIn({ user, account }) {
      try {
        // Always try to create/update user first
        const { error: userError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.image,
            google_id: user.id,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (userError) {
          console.error('Error in signIn - creating/updating user:', userError);
          return false;
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async jwt({ token, account, user }) {
      if (account && user) {
        try {
          // Ensure user exists and get their ID
          token.auth_user_id = user.id;

          // Handle account creation/linking
          const { data: accountData, error: accountError } = await supabaseAdmin
            .from('accounts')
            .upsert({
              owner_id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              account_type: 'google',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'email',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (accountError) {
            console.error('Error creating/updating account:', accountError);
            throw accountError;
          }

          // Save token information
          token.active_account_id = accountData.id;
          token.account = {
            id: accountData.id,
            name: user.name,
            email: user.email,
            image: user.image,
            account_type: 'google'
          };

          // Save tokens
          if (account.access_token) {
            const savedTokens = await saveUserTokens({
              authUserId: user.id,
              accountId: accountData.id,
              email: user.email,
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