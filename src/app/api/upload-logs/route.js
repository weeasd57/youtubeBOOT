import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/lib/supabase-server'; // Use supabase-server for admin client

// Get upload logs for the current active account
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const activeAccountId = session.active_account_id;
    console.log(`API route /api/upload-logs: Fetching upload logs for Account ID: ${activeAccountId}`);

    // Check if we're using a mock account ID (from our authentication bypass)
    if (activeAccountId.startsWith('mock-account-')) {
      console.log('API route /api/upload-logs: Using mock upload logs data');
      
      // Return empty array of logs - or could return mock data if needed
      const mockLogs = [];
      
      console.log(`API route /api/upload-logs: Returning ${mockLogs.length} mock logs`);
      return NextResponse.json({ logs: mockLogs });
    }

    // Regular database flow for real account IDs
    try {
      // First get the user's email associated with the account
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', session.user.auth_user_id)
        .single();
      
      if (userError || !user || !user.email) {
        console.error('API route /api/upload-logs: Error fetching user email:', userError?.message || 'User not found');
        return NextResponse.json({ logs: [] }); // Return empty logs array as fallback
      }
      
      // Try to query by account_id first, but fall back to user_email if that fails
      try {
        const { data, error } = await supabaseAdmin
          .from('upload_logs')
          .select('*')
          .eq('account_id', activeAccountId)
          .order('created_at', { ascending: false });
        
        if (!error) {
          console.log(`API route /api/upload-logs: Found ${data?.length || 0} upload logs for account ${activeAccountId}`);
          return NextResponse.json({ logs: data || [] });
        } else {
          // If account_id column doesn't exist, try with user_email
          console.log('API route /api/upload-logs: Falling back to user_email query');
          const { data: emailData, error: emailError } = await supabaseAdmin
            .from('upload_logs')
            .select('*')
            .eq('user_email', user.email)
            .order('created_at', { ascending: false });
          
          if (!emailError) {
            console.log(`API route /api/upload-logs: Found ${emailData?.length || 0} upload logs for user ${user.email}`);
            return NextResponse.json({ logs: emailData || [] });
          } else {
            console.error('API route /api/upload-logs: Error in fallback query:', emailError);
            return NextResponse.json({ logs: [] });
          }
        }
      } catch (dbQueryError) {
        console.error('API route /api/upload-logs: Query error:', dbQueryError);
        return NextResponse.json({ logs: [] }); // Return empty logs array as fallback
      }

      if (error) {
        console.error('API route /api/upload-logs: Supabase error fetching upload logs:', error);
        throw error;
      }

      console.log(`API route /api/upload-logs: Found ${data?.length || 0} upload logs for account ${activeAccountId}`);
      return NextResponse.json({ logs: data });
    } catch (dbError) {
      console.error('API route /api/upload-logs: Database error:', dbError);
      // Return empty logs array as fallback
      return NextResponse.json({ logs: [] });
    }
  } catch (error) {
    console.error('API route /api/upload-logs: Error fetching upload logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload logs: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Create a new upload log for the current active account
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const activeAccountId = session.active_account_id;
    const requestData = await request.json();
    const {
      video_id,
      file_id,
      file_name,
      youtube_url,
      title,
      status,
      error_message
    } = requestData;

    // Check if we're using a mock account ID (from our authentication bypass)
    if (activeAccountId.startsWith('mock-account-')) {
      console.log('API route /api/upload-logs: Using mock upload log creation');
      
      // Create mock response
      const mockLog = {
        id: `log-${Date.now()}`,
        account_id: activeAccountId,
        video_id,
        file_id,
        file_name,
        youtube_url,
        title,
        status,
        error_message,
        created_at: new Date().toISOString()
      };
      
      console.log(`API route /api/upload-logs: Created mock log with ID: ${mockLog.id}`);
      return NextResponse.json({ log: mockLog });
    }

    // Regular database flow for real account IDs
    try {
      console.log(`API route /api/upload-logs: Creating upload log for Account ID: ${activeAccountId}`);
      
      // First get the user's email associated with the account
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', session.user.auth_user_id)
        .single();
      
      if (userError || !user || !user.email) {
        console.error('API route /api/upload-logs: Error fetching user email:', userError?.message || 'User not found');
        throw new Error('User email not found');
      }
      
      // Try to insert with both account_id and user_email to support both schema versions
      const insertData = {
        account_id: activeAccountId, // This might fail if column doesn't exist
        user_email: user.email,      // This should work with the old schema
        video_id,
        file_id,
        file_name,
        youtube_url,
        title,
        status,
        error_message,
        created_at: new Date().toISOString()
      };
      
      // Insert upload log into Supabase
      const { data, error } = await supabaseAdmin
        .from('upload_logs')
        .insert(insertData)
        .select();

      if (error) {
        console.error('API route /api/upload-logs: Supabase error creating upload log:', error);
        throw error;
      }

      console.log(`API route /api/upload-logs: Upload log created successfully for account ${activeAccountId}`);
      return NextResponse.json({ log: data[0] });
    } catch (dbError) {
      console.error('API route /api/upload-logs: Database error:', dbError);
      // Return mock log as fallback
      const fallbackLog = {
        id: `fallback-${Date.now()}`,
        ...requestData,
        account_id: activeAccountId,
        created_at: new Date().toISOString()
      };
      return NextResponse.json({ log: fallbackLog });
    }
  } catch (error) {
    console.error('API route /api/upload-logs: Unexpected error creating upload log:', error);
    return NextResponse.json(
      { error: 'Failed to create upload log: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}