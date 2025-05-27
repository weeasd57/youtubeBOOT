import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
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

    // TODO: Implement logic to update the user's session/JWT with the new active_account_id
    // As discussed, this is typically triggered client-side after this API call succeeds.
    // The client will need to call update() or getSession({ event: 'callback' })

    // For now, just return a success message. The client will need to handle session update.
    return NextResponse.json({ message: 'Account switch request validated. Client should update session.', newAccountId: accountId }, { status: 200 });

  } catch (error) {
    console.error('API route /api/accounts/switch: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}