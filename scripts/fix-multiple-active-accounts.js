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

async function fixMultipleActiveAccounts() {
  try {
    console.log('Fixing multiple active accounts issue...');
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, active_account_id');
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }
    
    console.log(`Found ${users.length} users`);
    
    for (const user of users) {
      console.log(`\nProcessing user: ${user.email} (${user.id})`);
      
      // Get all accounts for this user
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, email, is_primary, is_active')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });
      
      if (accountsError) {
        console.error(`Error fetching accounts for user ${user.id}:`, accountsError);
        continue;
      }
      
      console.log(`  Found ${accounts.length} accounts`);
      
      if (accounts.length === 0) {
        console.log('  No accounts found for this user');
        continue;
      }
      
      // Check if there are multiple active accounts
      const activeAccounts = accounts.filter(acc => acc.is_active);
      console.log(`  Active accounts: ${activeAccounts.length}`);
      
      if (activeAccounts.length > 1) {
        console.log('  ❌ Multiple active accounts found - fixing...');
        
        // First, set all accounts to inactive
        const { error: deactivateError } = await supabase
          .from('accounts')
          .update({ is_active: false })
          .eq('owner_id', user.id);
        
        if (deactivateError) {
          console.error(`  Error deactivating accounts for user ${user.id}:`, deactivateError);
          continue;
        }
        
        // Determine which account should be active
        let accountToActivate = null;
        
        // Priority 1: Use the user's active_account_id if it exists and is valid
        if (user.active_account_id) {
          accountToActivate = accounts.find(acc => acc.id === user.active_account_id);
          if (accountToActivate) {
            console.log(`  Using user's active_account_id: ${accountToActivate.id}`);
          }
        }
        
        // Priority 2: Use the primary account
        if (!accountToActivate) {
          accountToActivate = accounts.find(acc => acc.is_primary);
          if (accountToActivate) {
            console.log(`  Using primary account: ${accountToActivate.id}`);
          }
        }
        
        // Priority 3: Use the first account (oldest)
        if (!accountToActivate) {
          accountToActivate = accounts[0];
          console.log(`  Using first account: ${accountToActivate.id}`);
        }
        
        // Activate the chosen account
        const { error: activateError } = await supabase
          .from('accounts')
          .update({ is_active: true })
          .eq('id', accountToActivate.id);
        
        if (activateError) {
          console.error(`  Error activating account ${accountToActivate.id}:`, activateError);
          continue;
        }
        
        // Update user's active_account_id if needed
        if (user.active_account_id !== accountToActivate.id) {
          const { error: updateUserError } = await supabase
            .from('users')
            .update({ active_account_id: accountToActivate.id })
            .eq('id', user.id);
          
          if (updateUserError) {
            console.error(`  Error updating user active_account_id:`, updateUserError);
          } else {
            console.log(`  Updated user active_account_id to: ${accountToActivate.id}`);
          }
        }
        
        console.log(`  ✅ Fixed - Account ${accountToActivate.id} is now the only active account`);
        
      } else if (activeAccounts.length === 1) {
        console.log('  ✅ Only one active account - no fix needed');
        
        // Ensure user's active_account_id matches the active account
        const activeAccount = activeAccounts[0];
        if (user.active_account_id !== activeAccount.id) {
          const { error: updateUserError } = await supabase
            .from('users')
            .update({ active_account_id: activeAccount.id })
            .eq('id', user.id);
          
          if (updateUserError) {
            console.error(`  Error updating user active_account_id:`, updateUserError);
          } else {
            console.log(`  Updated user active_account_id to match active account: ${activeAccount.id}`);
          }
        }
        
      } else {
        console.log('  ❌ No active accounts found - fixing...');
        
        // Activate the primary account or first account
        let accountToActivate = accounts.find(acc => acc.is_primary) || accounts[0];
        
        const { error: activateError } = await supabase
          .from('accounts')
          .update({ is_active: true })
          .eq('id', accountToActivate.id);
        
        if (activateError) {
          console.error(`  Error activating account ${accountToActivate.id}:`, activateError);
          continue;
        }
        
        // Update user's active_account_id
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ active_account_id: accountToActivate.id })
          .eq('id', user.id);
        
        if (updateUserError) {
          console.error(`  Error updating user active_account_id:`, updateUserError);
        } else {
          console.log(`  Updated user active_account_id to: ${accountToActivate.id}`);
        }
        
        console.log(`  ✅ Fixed - Account ${accountToActivate.id} is now active`);
      }
    }
    
    console.log('\n✅ Multiple active accounts fix completed!');
    
  } catch (error) {
    console.error('Error during fix:', error);
  }
}

fixMultipleActiveAccounts();