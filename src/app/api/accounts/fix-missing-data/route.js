import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// API route to fix missing email and image data in accounts
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.auth_user_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    console.log(`Fixing missing data for user: ${authUserId}`);

    // Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, name, avatar_url')
      .eq('id', authUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all accounts for this user that are missing email or image
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('owner_id', authUserId)
      .or('email.is.null,image.is.null');

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'No accounts need fixing' });
    }

    // Update accounts with missing data
    const updates = [];
    for (const account of accounts) {
      const updateData = {};
      
      if (!account.email) {
        updateData.email = userData.email;
      }
      
      if (!account.image && userData.avatar_url) {
        updateData.image = userData.avatar_url;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('accounts')
          .update(updateData)
          .eq('id', account.id);

        if (updateError) {
          console.error(`Error updating account ${account.id}:`, updateError);
        } else {
          updates.push({ accountId: account.id, updated: updateData });
        }
      }
    }

    return NextResponse.json({ 
      message: `Fixed ${updates.length} accounts`,
      updates 
    });

  } catch (error) {
    console.error('Error fixing account data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}