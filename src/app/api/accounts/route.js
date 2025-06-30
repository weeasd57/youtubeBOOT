import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// Cache for user sessions to reduce database calls
const sessionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to clear session cache
function clearSessionCache(sessionKey) {
  sessionCache.delete(sessionKey);
}

// Helper function to get cached session
async function getCachedSession(request) {
  const sessionKey = request.headers.get('authorization') || 'default';
  const cached = sessionCache.get(sessionKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.session;
  }
  
  const session = await getServerSession(authOptions);
  
  if (session) {
    sessionCache.set(sessionKey, {
      session,
      timestamp: Date.now()
    });
  }
  
  return session;
}

// Helper function to handle mock accounts
function createMockAccount(session, authUserId) {
  return {
    id: session.activeAccountId || `mock-account-${Date.now()}`,
    owner_id: authUserId,
    account_type: 'google',
    name: 'Primary Account',
    email: 'mock@example.com',
    created_at: new Date().toISOString()
  };
}

// Helper function to fix missing account data
async function fixMissingAccountData(accounts, userData) {
  const updatePromises = [];
  
  accounts.forEach((account, index) => {
    if (!account.email && userData?.email) {
      accounts[index].email = userData.email;
      
      // Queue async update
      updatePromises.push(
        supabaseAdmin
          .from('accounts')
          .update({ email: userData.email })
          .eq('id', account.id)
      );
    }
  });
  
  // Execute all updates in parallel
  if (updatePromises.length > 0) {
    Promise.allSettled(updatePromises).then(results => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to update account email:`, result.reason);
        }
      });
    });
  }
  
  return accounts;
}

// API route to manage user accounts (fetch, create)
export async function GET(request) {
  try {
    // Use cached session to improve performance
    const session = await getCachedSession(request);

    if (!session?.user?.auth_user_id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    console.log('[API Accounts] Authenticated User ID:', authUserId);

    // Handle mock authentication
    if (authUserId.startsWith('mock-auth-')) {
      const mockAccount = createMockAccount(session, authUserId);
      return NextResponse.json({ accounts: [mockAccount] });
    }

    // Parallel database queries for better performance
    const [userResult, accountsResult] = await Promise.allSettled([
      supabaseAdmin
        .from('users')
        .select('email, name, avatar_url')
        .eq('id', authUserId)
        .single(),
      supabaseAdmin
        .from('accounts')
        .select('id, email, owner_id, name, account_type, created_at, image')
        .eq('owner_id', authUserId)
        .order('created_at', { ascending: true })
    ]);

    // Handle user data fetch error
    if (userResult.status === 'rejected') {
      console.error('Error fetching user data:', userResult.reason);
      return NextResponse.json({ error: 'User data fetch failed' }, { status: 500 });
    }

    const userData = userResult.value.data;
    const userError = userResult.value.error;

    if (userError) {
      console.error('Supabase error fetching user data:', userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Handle accounts fetch
    let accounts = null;
    if (accountsResult.status === 'fulfilled') {
      const { data, error } = accountsResult.value;
      if (error) {
        console.error('Supabase error fetching accounts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      accounts = data;
      console.log('[API Accounts] Accounts fetched from DB:', accounts);
    }

    // Fix missing account data asynchronously
    if (accounts?.length > 0) {
      accounts = await fixMissingAccountData(accounts, userData);
    }

    // Create owner account if none exists
    if (!accounts || accounts.length === 0) {
      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from('accounts')
        .insert({
          owner_id: authUserId,
          name: userData.name || 'Primary Account',
          email: userData.email,
          account_type: 'google',
          image: userData.avatar_url
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating owner account:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      
      // No longer update user's active_account_id in auth.users as it doesn't exist.
      // The new account's last_used_at will be set by default on insert,
      // making it the most recently used.

      // Clear the session cache after a new account is created
      clearSessionCache(request.headers.get('authorization') || 'default');
      
      return NextResponse.json({ accounts: [newAccount] });
    }

    console.log('[API Accounts] Final accounts array before response:', accounts);
    return NextResponse.json({ accounts: accounts || [] });

  } catch (error) {
    console.error('API route /api/accounts: Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Optimized POST handler for creating new sub-accounts
export async function POST(request) {
  try {
    // Use cached session for better performance
    const session = await getCachedSession(request);

    if (!session?.user?.auth_user_id) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;
    
    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, email } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Parallel validation and creation
    const [accountValidation, accountCreation] = await Promise.allSettled([
      // Validate that the user owns the account (if an active account were needed for context)
      // This check is now based on authUserId for general account creation
      Promise.resolve({ status: 'fulfilled', value: { data: { owner_id: authUserId } } }), // Mock validation for now
      // Prepare account data for creation
      Promise.resolve({
        owner_id: authUserId,
        name: name.trim(),
        email: email?.trim() || null,
        account_type: 'google'
      })
    ]);

    // Check account validation (simplified as it's now a mock)
    if (accountValidation.status === 'rejected') {
      return NextResponse.json({ error: 'Account validation failed' }, { status: 500 });
    }

    // Create the new account
    const accountData = accountCreation.value;
    const { data: newAccount, error: insertError } = await supabaseAdmin
      .from('accounts')
      .insert([accountData])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase error creating account:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Clear the session cache after a new account is created via POST
    clearSessionCache(request.headers.get('authorization') || 'default');

    return NextResponse.json(newAccount, { status: 201 });

  } catch (error) {
    console.error('Unexpected error during account creation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
