import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// API route to manage user accounts (fetch, create)

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.auth_user_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    console.log(`API route /api/accounts: Fetching accounts for Auth User ID: ${authUserId}`);

    // Check if we're using a mock auth ID (from our authentication bypass)
    if (authUserId.startsWith('mock-auth-')) {
      console.log('API route /api/accounts: Using mock account data');
      
      // Create mock account data
      const mockAccounts = [
        {
          id: session.activeAccountId || `mock-account-${Date.now()}`,
          owner_id: authUserId,
          account_type: 'google',
          name: 'Primary Account',
          email: 'mock@example.com',
          created_at: new Date().toISOString()
        }
      ];
      
      console.log(`API route /api/accounts: Returning ${mockAccounts.length} mock accounts`);
      return NextResponse.json({ accounts: mockAccounts });
    }

    // Get user data to ensure we have the owner account details
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, name, avatar_url')
      .eq('id', authUserId)
      .single();

    if (userError) {
      console.error('API route /api/accounts: Supabase error fetching user data:', userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }
    
    // Regular database flow for real auth IDs - get all connected accounts
    const { data: accounts, error } = await supabaseAdmin
      .from('accounts')
      .select('id, email, owner_id, name, account_type, created_at, image')
      .eq('owner_id', authUserId)
      .order('created_at', { ascending: true }); // Order by creation date

    if (error) {
      console.error('API route /api/accounts: Supabase error fetching accounts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`API route /api/accounts: Found ${accounts?.length || 0} accounts for user ${authUserId}`);
    
    // تحقق من البيانات المفقودة في الحسابات
    if (accounts && accounts.length > 0) {
      accounts.forEach((account, index) => {
        console.log(`Account ${index + 1}: ID=${account.id}, Email=${account.email || 'MISSING'}, Name=${account.name || 'MISSING'}`);
        
        // إذا كان البريد الإلكتروني مفقودًا، حاول استخدام بريد المستخدم الأساسي
        if (!account.email && userData && userData.email) {
          console.log(`Fixing missing email for account ${account.id} with user email: ${userData.email}`);
          accounts[index].email = userData.email;
          
          // تحديث قاعدة البيانات بشكل غير متزامن
          supabaseAdmin
            .from('accounts')
            .update({ email: userData.email })
            .eq('id', account.id)
            .then(({ error }) => {
              if (error) {
                console.error(`Failed to update email for account ${account.id}:`, error);
              } else {
                console.log(`Successfully updated email for account ${account.id}`);
              }
            });
        }
      });
    }

    // If no accounts found for the user, create one automatically for the owner
    if (!accounts || accounts.length === 0) {
      console.log('No accounts found, creating owner account automatically');
      
      // Create new account for the owner
      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from('accounts')
        .insert({
          owner_id: authUserId,
          name: userData.name || 'Primary Account',
          email: userData.email,
          account_type: 'google', // Using 'google' as the account type for Google accounts
          image: userData.avatar_url
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating owner account:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      
      // Update user with the new active account
      await supabaseAdmin
        .from('users')
        .update({ active_account_id: newAccount.id })
        .eq('id', authUserId);
      
      console.log('Created new owner account:', newAccount.id);
      
      return NextResponse.json({ accounts: [newAccount] });
    }

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

    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields for POST:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json({ error: 'Not authenticated or active account not set' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    const body = await request.json();
    const { name, email } = body; // Required: name for the new account

    if (!name) {
        return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    // Check if the active account belongs to the user
    const { data: activeAccount, error: fetchAccountError } = await supabaseAdmin
        .from('accounts')
        .select('id, account_type, owner_id')
        .eq('id', activeAccountId)
        .single();

    if (fetchAccountError || !activeAccount || activeAccount.owner_id !== authUserId) {
        console.warn(`API route /api/accounts: User ${authUserId} attempted to create account from unowned account ${activeAccountId}`);
        return NextResponse.json({ error: 'Unauthorized: Can only create accounts you own' }, { status: 403 });
    }

    console.log(`API route /api/accounts: Creating account for user ${authUserId}`);

    // Insert the new account
    const { data: newAccount, error: insertError } = await supabaseAdmin
        .from('accounts')
        .insert([{
            owner_id: authUserId,
            name: name,
            email: email || null,
            account_type: 'google'
        }])
        .select()
        .single();

    if (insertError) {
        console.error('API route /api/accounts: Supabase error creating account:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log(`API route /api/accounts: Account created with ID: ${newAccount.id}`);

    return NextResponse.json(newAccount, { status: 201 }); // Return the newly created account

  } catch (error) {
    console.error('API route /api/accounts: Unexpected error during account creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
