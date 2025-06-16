import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/utils/session';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * API endpoint to fetch user tokens from the user_tokens table
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailParam = searchParams.get('email');
    
    // إنشاء Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    );
    
    // محاولة الحصول على الجلسة والمعرف
    const session = await getSession();
    const userEmail = emailParam || session?.user?.email;

    if (!userEmail) {
      console.log('No email found in session or params');
      return NextResponse.json({ tokens: [] });
    }

    console.log('Fetching tokens for email:', userEmail);
    
    // البحث عن الرموز مباشرة باستخدام البريد الإلكتروني
    const { data: tokens, error } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_email', userEmail);
    
    if (error) {
      console.error('Error fetching user tokens:', error);
      return NextResponse.json(
        { error: 'Failed to fetch user tokens', details: error.message },
        { status: 500 }
      );
    }

    console.log(`Found ${tokens?.length || 0} tokens for email ${userEmail}`);
    
    // تنسيق الرموز للواجهة الأمامية
    const formattedTokens = (tokens || []).map(token => ({
      id: token.account_id || token.id,
      name: token.name || `Account ${token.account_id?.substring(0, 6)}...`,
      email: token.user_email || null,
      accessToken: token.access_token || null,
      refreshToken: token.refresh_token || null,
      expiresAt: token.expires_at || null
    }));
    
    return NextResponse.json({ tokens: formattedTokens });
  } catch (error) {
    console.error('Error in user tokens API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
} 