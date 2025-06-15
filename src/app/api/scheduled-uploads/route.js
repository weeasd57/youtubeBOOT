import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// Get scheduled uploads for the current active account
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

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    console.log(`API route /api/scheduled-uploads: Fetching scheduled uploads for Account ID: ${activeAccountId}`);

    let userEmail;

    // Check if authUserId is a number (real ID) or a string (mock ID)
    if (typeof authUserId === 'number' || (typeof authUserId === 'string' && !authUserId.startsWith('mock-auth-'))) {
      // Assume it's a real user ID, fetch email from users table
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', authUserId)
        .single();

      if (userError || !user || !user.email) {
        console.error('API route /api/scheduled-uploads: Error fetching user email:', userError?.message || 'User not found');
        return NextResponse.json({ error: 'User email not found' }, { status: 500 });
      }
      userEmail = user.email;
    } else if (typeof authUserId === 'string' && authUserId.startsWith('mock-auth-')) {
      // It's a mock ID, extract email from the mock ID string
      // Assuming the format is 'mock-auth-email-address-with-hyphens'
      userEmail = authUserId.substring('mock-auth-'.length).replace(/-/g, '.').replace(/\.(com|org|net|etc)$/, '@$&').replace(/\.\./g, '.'); // Basic attempt to reverse hyphenation
      // A more robust approach might be needed depending on how the mock ID is generated
      console.warn(`API route /api/scheduled-uploads: Using mock user email derived from authUserId: ${userEmail}`);
       if (!userEmail || !userEmail.includes('@')) {
           console.error('API route /api/scheduled-uploads: Failed to derive valid email from mock authUserId:', authUserId);
           return NextResponse.json({ error: 'Invalid mock user ID format' }, { status: 500 });
       }
    } else {
        // Unexpected authUserId type
        console.error('API route /api/scheduled-uploads: Unexpected authUserId type:', typeof authUserId, authUserId);
        return NextResponse.json({ error: 'Invalid user identifier format' }, { status: 500 });
    }

    // Get scheduled uploads from database using the user's email
    const { data, error } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('*')
      .eq('user_email', userEmail) // Filter by user_email
      .order('scheduled_time', { ascending: true });

    if (error) {
      console.error('API route /api/scheduled-uploads: Supabase error fetching scheduled uploads:', error);
      throw error;
    }

    console.log(`API route /api/scheduled-uploads: Found ${data?.length || 0} scheduled uploads for account ${activeAccountId}`);

    return NextResponse.json({ scheduledUploads: data });
  } catch (error) {
    console.error('API route /api/scheduled-uploads: Error fetching scheduled uploads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled uploads: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Cancel a scheduled upload for the current active account
export async function DELETE(request) {
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

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing scheduled upload ID' }, { status: 400 });
    }

    console.log(`API route /api/scheduled-uploads: User attempting to cancel scheduled upload ID: ${id} for Account ID: ${activeAccountId}`);

    // First we need to get the user's email, since scheduled_uploads uses user_email not account_id
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', authUserId)
      .single();
      
    if (userError || !user || !user.email) {
      console.error('API route /api/scheduled-uploads: Error fetching user email:', userError?.message || 'User not found');
      return NextResponse.json({ error: 'User email not found' }, { status: 500 });
    }
    
    // Verify the scheduled upload belongs to the user
    const { data: upload, error: fetchError } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('id, user_email') // Select only necessary columns
      .eq('id', id)
      .eq('user_email', user.email) // Verify by user_email instead of account_id
      .single();

    if (fetchError || !upload) {
      console.warn(`API route /api/scheduled-uploads: Scheduled upload ID ${id} not found or does not belong to account ${activeAccountId}.`);
      return NextResponse.json({
        error: 'Scheduled upload not found or access denied'
      }, { status: 404 });
    }

    // Delete the scheduled upload
    const { error: deleteError } = await supabaseAdmin
      .from('scheduled_uploads')
      .delete()
      .eq('id', id); // Delete by ID

    if (deleteError) {
      console.error('API route /api/scheduled-uploads: Supabase error cancelling scheduled upload:', deleteError.message);
      return NextResponse.json({
        error: 'Failed to cancel scheduled upload: ' + deleteError.message
      }, { status: 500 });
    }

    console.log(`API route /api/scheduled-uploads: Scheduled upload ID ${id} cancelled successfully for account ${activeAccountId}`);

    return NextResponse.json({
      message: 'Scheduled upload cancelled successfully'
    });
  } catch (error) {
    console.error('API route /api/scheduled-uploads: Unexpected error cancelling scheduled upload:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled upload: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}