import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from 'next-auth'; // Import getServerSession
import { authOptions } from '@/app/api/auth/[...nextauth]/options'; // Import authOptions

export async function GET(request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const activeAccountId = session.active_account_id;
    console.log(`API route: Fetching TikTok videos for account ID: ${activeAccountId}`);

    // First get the user's email associated with the account
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', session.user.auth_user_id)
      .single();
      
    if (userError || !user || !user.email) {
      console.error('API route: Error fetching user email:', userError?.message || 'User not found');
      return NextResponse.json({ error: 'User email not found' }, { status: 500 });
    }

    // استعلام Supabase للحصول على بيانات فيديوهات TikTok المرتبطة بالمستخدم
    // Try multiple approaches to handle schema differences
    let data, error;

    // First try account_id
    try {
      const result = await supabaseAdmin
        .from('tiktok_videos')
        .select('*')
        .eq('account_id', activeAccountId)
        .order('created_at', { ascending: false });
      
      if (!result.error) {
        data = result.data;
        error = null;
      } else {
        // Fall back to user_email
        console.log('API route: Falling back to user_email for TikTok videos');
        const fallbackResult = await supabaseAdmin
          .from('tiktok_videos')
          .select('*')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false });
        
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
    } catch (queryError) {
      console.error('API route: Query error for TikTok videos:', queryError);
      // If all approaches fail, return an empty array
      data = [];
      error = queryError;
    }

    if (error) {
      console.error('API route: Supabase error fetching TikTok videos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API route: Found ${data?.length || 0} TikTok videos for account ${activeAccountId}`);
    // Optional: Log sample data if needed for debugging
    // console.log("API route: Sample videos:", data?.slice(0, 3));

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('API route: Unexpected error fetching TikTok videos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}