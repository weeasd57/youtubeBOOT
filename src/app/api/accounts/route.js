import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// API route to manage user accounts (fetch, create)

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.authUserId;
    console.log(`API route /api/accounts: Fetching accounts for Auth User ID: ${authUserId}`);

    // Check if we're using a mock auth ID (from our authentication bypass)
    if (authUserId.startsWith('mock-auth-')) {
      console.log('API route /api/accounts: Using mock account data');
      
      // Create mock account data
      const mockAccounts = [
        {
          id: session.activeAccountId || `mock-account-${Date.now()}`,
          owner_id: authUserId,
          account_type: 'primary',
          name: 'Primary Account',
          description: 'Your main account',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      
      console.log(`API route /api/accounts: Returning ${mockAccounts.length} mock accounts`);
      return NextResponse.json({ accounts: mockAccounts });
    }

    // Regular database flow for real auth IDs
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('owner_id', authUserId)
      .order('created_at', { ascending: true }); // Order by creation date

    if (error) {
      console.error('API route /api/accounts: Supabase error fetching accounts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API route /api/accounts: Found ${accounts?.length || 0} accounts for user ${authUserId}`);

    return NextResponse.json({ accounts: accounts || [] });

  } catch (error) {
    console.error('API route /api/accounts: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// TODO: Implement POST handler for creating new sub-accounts

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.authUserId || !session.activeAccountId) {
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const authUserId = session.authUserId;
    const activeAccountId = session.activeAccountId;
    const body = await request.json();
    const { name, description } = body; // Required: name for the new sub-account

    if (!name) {
        return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    // Check if the active account is a primary account owned by the user
    const { data: activeAccount, error: fetchAccountError } = await supabaseAdmin
        .from('accounts')
        .select('id, account_type, owner_id')
        .eq('id', activeAccountId)
        .single();

    if (fetchAccountError || !activeAccount || activeAccount.owner_id !== authUserId || activeAccount.account_type !== 'primary') {
        console.warn(`API route /api/accounts: User ${authUserId} attempted to create sub-account from non-primary or unowned account ${activeAccountId}`);
        return NextResponse.json({ error: 'Unauthorized: Can only create sub-accounts from your primary account' }, { status: 403 });
    }

    console.log(`API route /api/accounts: Creating sub-account for user ${authUserId} under primary account ${activeAccountId}`);

    // Insert the new sub-account
    const { data: newAccount, error: insertError } = await supabaseAdmin
        .from('accounts')
        .insert([{
            owner_id: authUserId, // Sub-account is also owned by the primary user
            parent_account_id: activeAccountId, // Link to the primary account
            account_type: 'sub',
            name: name,
            description: description,
            is_active: true // New accounts are active by default
        }])
        .select()
        .single();

    if (insertError) {
        console.error('API route /api/accounts: Supabase error creating sub-account:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log(`API route /api/accounts: Sub-account created with ID: ${newAccount.id}`);

    return NextResponse.json(newAccount, { status: 201 }); // Return the newly created account

  } catch (error) {
    console.error('API route /api/accounts: Unexpected error during sub-account creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
