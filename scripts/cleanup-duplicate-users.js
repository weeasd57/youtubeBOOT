const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateUsers() {
  try {
    console.log('Starting cleanup of duplicate users...');
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users`);
    
    if (users.length <= 1) {
      console.log('No duplicate users to clean up');
      return;
    }
    
    // Keep the first user (oldest) as the primary user
    const primaryUser = users[0];
    const duplicateUsers = users.slice(1);
    
    console.log(`Primary user: ${primaryUser.email} (${primaryUser.id})`);
    console.log(`Duplicate users: ${duplicateUsers.map(u => u.email).join(', ')}`);
    
    // Move all accounts from duplicate users to primary user
    for (const duplicateUser of duplicateUsers) {
      console.log(`Processing duplicate user: ${duplicateUser.email}`);
      
      // Update accounts to point to primary user
      const { error: updateAccountsError } = await supabase
        .from('accounts')
        .update({ owner_id: primaryUser.id })
        .eq('owner_id', duplicateUser.id);
      
      if (updateAccountsError) {
        console.error(`Error updating accounts for user ${duplicateUser.id}:`, updateAccountsError);
        continue;
      }
      
      // Update user_tokens to point to primary user
      const { error: updateTokensError } = await supabase
        .from('user_tokens')
        .update({ auth_user_id: primaryUser.id })
        .eq('auth_user_id', duplicateUser.id);
      
      if (updateTokensError) {
        console.error(`Error updating tokens for user ${duplicateUser.id}:`, updateTokensError);
      }
      
      // Delete the duplicate user
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', duplicateUser.id);
      
      if (deleteUserError) {
        console.error(`Error deleting duplicate user ${duplicateUser.id}:`, deleteUserError);
      } else {
        console.log(`Deleted duplicate user: ${duplicateUser.email}`);
      }
    }
    
    // Ensure one account is marked as primary
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('owner_id', primaryUser.id)
      .order('created_at', { ascending: true });
    
    if (!accountsError && accounts && accounts.length > 0) {
      // Check if any account is marked as primary
      const hasPrimary = accounts.some(acc => acc.is_primary);
      
      if (!hasPrimary) {
        // Mark the first account as primary
        const { error: setPrimaryError } = await supabase
          .from('accounts')
          .update({ is_primary: true })
          .eq('id', accounts[0].id);
        
        if (setPrimaryError) {
          console.error('Error setting primary account:', setPrimaryError);
        } else {
          console.log(`Set account ${accounts[0].id} as primary`);
        }
      }
      
      // Update user's active_account_id
      const primaryAccount = accounts.find(acc => acc.is_primary) || accounts[0];
      const { error: updateUserError } = await supabase
        .from('users')
        .update({ active_account_id: primaryAccount.id })
        .eq('id', primaryUser.id);
      
      if (updateUserError) {
        console.error('Error updating user active account:', updateUserError);
      } else {
        console.log(`Updated user active account to: ${primaryAccount.id}`);
      }
    }
    
    console.log('Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

cleanupDuplicateUsers();