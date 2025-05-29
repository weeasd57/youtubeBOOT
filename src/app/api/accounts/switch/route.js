import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';
// import { updateSession } from 'next-auth/react'; // updateSession is client-side

// API route to switch the active account

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.authUserId;
    const body = await request.json();
    const { accountId } = body; // Required: ID of the account to switch to

    if (!accountId) {
        return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    console.log(`API route /api/accounts/switch: User ${authUserId} attempting to switch to account ID: ${accountId}`);

    // Verify if the user has access to the requested accountId
    // Check if the user is the owner of this account
    const { data: account, error: fetchAccountError } = await supabaseAdmin
        .from('accounts')
        .select('id, owner_id')
        .eq('id', accountId)
        .single();

    if (fetchAccountError || !account) {
        console.warn(`API route /api/accounts/switch: Account with ID ${accountId} not found or user ${authUserId} does not own it.`);
        return NextResponse.json({ error: 'Account not found or access denied' }, { status: 404 });
    }

    if (account.owner_id !== authUserId) {
         // TODO: Implement check for account_roles table if users can be members without being owners
         console.warn(`API route /api/accounts/switch: User ${authUserId} is not the owner of account ${accountId}. Access denied.`);
         return NextResponse.json({ error: 'Access denied to this account' }, { status: 403 });
    }

    console.log(`API route /api/accounts/switch: User ${authUserId} has access to account ID: ${accountId}`);

    // First, deactivate all accounts for this user to ensure only one is active
    const { error: deactivateError } = await supabaseAdmin
      .from('accounts')
      .update({ is_active: false })
      .eq('owner_id', authUserId);

    if (deactivateError) {
      console.error('Error deactivating accounts:', deactivateError);
      return NextResponse.json({ error: 'Failed to deactivate accounts' }, { status: 500 });
    }

    // Then activate the selected account and update its timestamp
    const { error: activateError } = await supabaseAdmin
      .from('accounts')
      .update({
        is_active: true,
        last_used_at: new Date().toISOString()
      })
      .eq('id', accountId)
      .eq('owner_id', authUserId);

    if (activateError) {
      console.error('Error activating account:', activateError);
      return NextResponse.json({ error: 'Failed to activate account' }, { status: 500 });
    }

    // Update the user's active account
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        active_account_id: accountId,
        updated_at: new Date().toISOString()
      })
      .eq('id', authUserId);

    if (updateError) {
      console.error('Error updating user active account:', updateError);
      return NextResponse.json({ error: 'Failed to update active account' }, { status: 500 });
    }

    console.log(`API route /api/accounts/switch: Successfully switched user ${authUserId} to account ${accountId}`);

    // Return success message. The client will need to handle session update.
    return NextResponse.json({
      message: 'Account switched successfully',
      newAccountId: accountId,
      success: true
    }, { status: 200 });

  } catch (error) {
    console.error('API route /api/accounts/switch: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}