import GoogleProvider from 'next-auth/providers/google';
import { saveUserToSupabase, saveUserTokens, supabaseAdmin } from '@/utils/supabase-server';

// NextAuth configuration options
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code'
        }
      },
      userinfo: {
        params: { fields: 'id,email,name,picture' },
      },
      profile(profile) {
        return {
          id: profile.sub || profile.id,
          name: profile.name,
          email: profile.email,
          image: profile.picture
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account, user, trigger, req }) {
      // Initial sign in
      if (account && user) {
        console.log('JWT callback - Initial sign in for:', user.email);

        try {
          // Check if this is a new sign-in or an additional account
          let isAdditionalAccount = token && token.auth_user_id;
          
          // Check if we're adding an account (from cookie set by middleware)
          if (!isAdditionalAccount && req?.cookies) {
            const addingAccountFor = req.cookies.addingAccountFor;
            if (addingAccountFor) {
              console.log('Found addingAccountFor cookie:', addingAccountFor);
              isAdditionalAccount = true;
              token.auth_user_id = addingAccountFor;
              
              // Clear the cookie by setting it to expire
              if (req.res) {
                req.res.setHeader('Set-Cookie', 'addingAccountFor=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
              }
            }
          }
          
          // Enhanced fallback: Check if this Google account should be linked to an existing user
          if (!isAdditionalAccount) {
            // First, check if there's already an account with this exact email
            const { data: existingAccount, error: accountCheckError } = await supabaseAdmin
              .from('accounts')
              .select('id, owner_id, email')
              .eq('email', user.email)
              .single();
            
            if (!accountCheckError && existingAccount) {
              // This exact Google account already exists, use the existing user
              console.log('Google account already exists, using existing user:', existingAccount.owner_id);
              isAdditionalAccount = true;
              token.auth_user_id = existingAccount.owner_id;
            } else {
              // Check if there's a user in the database who might want to add this as additional account
              // This happens when user signs in from landing page first, then adds another Google account
              const { data: existingUser, error: userCheckError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', user.email)
                .single();
              
              if (!userCheckError && existingUser) {
                // User exists but this Google account doesn't - this could be an additional account
                const { data: userAccounts, error: accountsError } = await supabaseAdmin
                  .from('accounts')
                  .select('id, email')
                  .eq('owner_id', existingUser.id);
                
                if (!accountsError && userAccounts && userAccounts.length > 0) {
                  // User has existing accounts, this is likely an additional account
                  const accountExists = userAccounts.some(acc => acc.email === user.email);
                  if (!accountExists) {
                    console.log('Detected additional Google account for existing user:', existingUser.id);
                    isAdditionalAccount = true;
                    token.auth_user_id = existingUser.id;
                  }
                }
              }
            }
          }

          if (isAdditionalAccount) {
            // This block handles adding an additional account to a user who is already logged in
            console.log('Adding another account for existing user:', token.auth_user_id);

            // Get the existing user data from public.users
            const { data: existingUser, error: userError } = await supabaseAdmin
              .from('users')
              .select('id') // Only need the ID to confirm existence
              .eq('id', token.auth_user_id)
              .single();

            if (userError || !existingUser) {
              // If the user somehow doesn't exist in public.users despite auth_user_id on token, this is an issue
              throw new Error(`Failed to fetch existing user (${token.auth_user_id}) from public.users: ${userError?.message}`);
            }

            // Check if an account with this email already exists for this user
            const { data: existingAccount, error: existingAccountError } = await supabaseAdmin
              .from('accounts')
              .select('id, email')
              .eq('owner_id', token.auth_user_id)
              .eq('email', user.email)
              .single();

            let accountId;
            
            if (!existingAccountError && existingAccount) {
              // Account with this email already exists for this user - update its tokens
              console.log('Account with email already exists, updating tokens:', existingAccount.id);
              accountId = existingAccount.id;
            } else {
              // Create a new account entry in public.accounts for this Google account
              const { data: newAccount, error: accountError } = await supabaseAdmin
                .from('accounts')
                .insert({
                  owner_id: token.auth_user_id, // Link to the authenticated user
                  name: user.name || 'Google Account', // Use Google profile name
                  account_type: 'google',
                  email: user.email, // Store the account's email
                  image: user.image, // Store the account's profile image
                  is_primary: false, // New accounts are not primary by default
                })
                .select() // Return the inserted account
                .single();

              if (accountError) {
                console.error('Error creating additional account in public.accounts:', accountError);
                throw new Error(`Failed to create additional account: ${accountError.message}`);
              }

              console.log('Successfully added new account:', newAccount.id);
              accountId = newAccount.id;
            }

            // Save tokens for this account - associate with the specific account ID
            const savedTokens = await saveUserTokens({
              authUserId: token.auth_user_id, // Pass authUserId
              accountId: accountId, // Pass the specific account ID
              email: user.email,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at
            });

            if (!savedTokens) {
              throw new Error('Failed to save tokens for additional account');
            }

            // Don't switch to the new account automatically - keep the current active account
            // Get the current active account info to maintain it
            const { data: currentActiveAccount, error: activeAccountError } = await supabaseAdmin
              .from('accounts')
              .select('id, name, email, image, account_type')
              .eq('id', token.active_account_id)
              .single();

            if (activeAccountError || !currentActiveAccount) {
              // If current active account is not found, fall back to the new account
              return {
                ...token,
                active_account_id: accountId,
                access_token: savedTokens.access_token,
                refresh_token: savedTokens.refresh_token,
                expires_at: savedTokens.expires_at,
                auth_user_id: token.auth_user_id,
                account: {
                  id: accountId,
                  name: user.name || 'Google Account',
                  email: user.email,
                  image: user.image,
                  account_type: 'google',
                }
              };
            }

            // Keep the current active account and its tokens
            const { data: currentTokens, error: tokenError } = await supabaseAdmin
              .from('user_tokens')
              .select('access_token, refresh_token, expires_at')
              .eq('auth_user_id', token.auth_user_id)
              .eq('account_id', token.active_account_id)
              .single();

            return {
              ...token,
              // Keep the current active account
              active_account_id: token.active_account_id,
              // Use current account's tokens if available, otherwise use new account's tokens
              access_token: currentTokens?.access_token || savedTokens.access_token,
              refresh_token: currentTokens?.refresh_token || savedTokens.refresh_token,
              expires_at: currentTokens?.expires_at || savedTokens.expires_at,
              auth_user_id: token.auth_user_id,
              account: currentActiveAccount
            };

          } else {
            // Regular first-time sign in flow
            console.log('Regular first-time sign in flow or existing user without auth_user_id in token:', user.email);

            // IMPORTANT: For additional accounts, we should NOT create a new user
            // Instead, we should find the primary user and link this account to them
            
            let savedUser = null;
            
            // First, check if there's already a user in the system (any user)
            // This handles the case where user signs in with one Gmail, then adds another Gmail
            const { data: anyExistingUser, error: anyUserError } = await supabaseAdmin
              .from('users')
              .select('*')
              .limit(1)
              .single();

            if (!anyUserError && anyExistingUser) {
              // There's already a user in the system, this should be an additional account
              console.log('Found existing user in system, treating as additional account:', anyExistingUser.id);
              savedUser = anyExistingUser;
              
              // Mark this as additional account
              isAdditionalAccount = true;
              token.auth_user_id = anyExistingUser.id;
            } else {
              // No users in system yet, this is truly the first user
              console.log('No users in system, creating first user');
              savedUser = await saveUserToSupabase(user);
              if (!savedUser || !savedUser.id) {
                console.error('Failed to save or retrieve user data from public.users for email:', user.email);
                throw new Error('Failed to save or retrieve user data from public.users');
              }
            }

            // If this was detected as an additional account, handle it like the additional account flow
            if (isAdditionalAccount) {
              console.log('Redirecting to additional account flow for user:', savedUser.id);
              
              // Create a new account entry in public.accounts for this Google account
              const { data: newAccount, error: accountError } = await supabaseAdmin
                .from('accounts')
                .insert({
                  owner_id: savedUser.id, // Link to the existing user
                  name: user.name || 'Google Account', // Use Google profile name
                  account_type: 'google',
                  email: user.email, // Store the account's email
                  image: user.image, // Store the account's profile image
                  is_primary: false, // New accounts are not primary by default
                })
                .select() // Return the inserted account
                .single();

              if (accountError) {
                console.error('Error creating additional account in public.accounts:', accountError);
                throw new Error(`Failed to create additional account: ${accountError.message}`);
              }

              console.log('Successfully added new account:', newAccount.id);

              // Save tokens for this new account
              const savedTokens = await saveUserTokens({
                authUserId: savedUser.id,
                accountId: newAccount.id,
                email: user.email,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at
              });

              if (!savedTokens) {
                throw new Error('Failed to save tokens for additional account');
              }

              // Get the current primary account to keep it active
              const { data: primaryAccount, error: primaryError } = await supabaseAdmin
                .from('accounts')
                .select('id, name, email, image, account_type')
                .eq('owner_id', savedUser.id)
                .eq('is_primary', true)
                .single();

              if (primaryError || !primaryAccount) {
                // If no primary account found, make this one primary
                await supabaseAdmin
                  .from('accounts')
                  .update({ is_primary: true })
                  .eq('id', newAccount.id);

                return {
                  ...token,
                  auth_user_id: savedUser.id,
                  active_account_id: newAccount.id,
                  access_token: savedTokens.access_token,
                  refresh_token: savedTokens.refresh_token,
                  expires_at: savedTokens.expires_at,
                  error: null,
                  user: {
                    id: savedUser.id,
                    email: savedUser.email,
                    name: savedUser.name,
                    image: savedUser.avatar_url,
                  },
                  account: {
                    id: newAccount.id,
                    name: newAccount.name,
                    email: newAccount.email,
                    image: newAccount.image,
                    account_type: newAccount.account_type,
                  }
                };
              }

              // Keep the primary account active
              const { data: primaryTokens, error: tokenError } = await supabaseAdmin
                .from('user_tokens')
                .select('access_token, refresh_token, expires_at')
                .eq('auth_user_id', savedUser.id)
                .eq('account_id', primaryAccount.id)
                .single();

              return {
                ...token,
                auth_user_id: savedUser.id,
                active_account_id: primaryAccount.id,
                access_token: primaryTokens?.access_token || savedTokens.access_token,
                refresh_token: primaryTokens?.refresh_token || savedTokens.refresh_token,
                expires_at: primaryTokens?.expires_at || savedTokens.expires_at,
                error: null,
                user: {
                  id: savedUser.id,
                  email: savedUser.email,
                  name: savedUser.name,
                  image: savedUser.avatar_url,
                },
                account: primaryAccount
              };
            }

            console.log('Saved user details:', {
              id: savedUser.id,
              email: savedUser.email,
              name: savedUser.name
            });

            // Verify the user actually exists in the database
            const { data: verifyUser, error: verifyError } = await supabaseAdmin
              .from('users')
              .select('id, email, name')
              .eq('id', savedUser.id)
              .single();

            console.log('User verification result:', {
              verifyUser,
              verifyError,
              searchedId: savedUser.id
            });

            if (verifyError || !verifyUser) {
              console.error('CRITICAL: User not found after upsert!', verifyError);
              throw new Error(`User verification failed: ${verifyError?.message}`);
            }

            let activeAccountId = savedUser.active_account_id;
            let activeAccountDetails = null;


            // --- Start: New check for existing accounts to prevent concurrent primary account creation ---
            console.log(`Checking for existing accounts for user ID: ${savedUser.id}`);
            const { data: existingAccounts, error: fetchAccountsError } = await supabaseAdmin
              .from('accounts')
              .select('id, name, account_type')
              .eq('owner_id', savedUser.id);

            console.log(`Fetch accounts result:`, {
              existingAccounts,
              fetchAccountsError,
              accountsLength: existingAccounts?.length,
              savedUserId: savedUser.id
            });

            if (fetchAccountsError) {
                console.error('Error fetching existing accounts for user:', savedUser.id, fetchAccountsError);
                throw new Error(`Failed to check for existing accounts: ${fetchAccountsError.message}`);
            }

            if (existingAccounts && existingAccounts.length > 0) {
                // User already has one or more accounts in the 'accounts' table.
                // This user is not in the initial primary account creation state.
                console.log(`User ${savedUser.id} already has ${existingAccounts.length} account(s) in the database. Skipping primary account creation flow.`);

                // If savedUser.active_account_id is not set despite having accounts, find the first one and set it?
                // Or assume the one marked active in the users table is correct if it exists in the list?
                // Let's prioritize the active_account_id from the users table if it refers to an existing account.
                if (activeAccountId) {
                     const foundActiveAccount = existingAccounts.find(acc => acc.id === activeAccountId);
                     if (foundActiveAccount) {
                         // Populate activeAccountDetails with found account, excluding email/image
                         activeAccountDetails = {
                             id: foundActiveAccount.id,
                             name: foundActiveAccount.name,
                             account_type: foundActiveAccount.account_type,
                         }; // Changed activeAccountDetails population
                         console.log(`Fetched details for existing active account ${activeAccountId}.`);
                     } else {
                         // active_account_id in users table points to a non-existent account. This is an inconsistency.
                         // Decide how to handle: Could pick the first account, or throw an error.
                         // Throwing an error is safer to highlight the data inconsistency.
                          console.error(`Inconsistency: User ${savedUser.id} has active_account_id ${activeAccountId} but it does not exist in the accounts table.`);
                          throw new Error(`Account data inconsistency for user ${savedUser.id}.`);
                     }
                } else {
                    // User has accounts, but no active_account_id is set in the users table.
                    // This could happen if the user update step failed previously.
                    // We need to pick an active account and update the user record.
                    // Let's pick the first account found as the active one.
                    const accountToActivate = existingAccounts[0];
                    activeAccountId = accountToActivate.id;
                    activeAccountDetails = accountToActivate;

                    console.log(`User ${savedUser.id} has accounts but no active_account_id. Setting active to first account found: ${activeAccountId}`);

                    // Update the user record with the newly determined active_account_id
                    console.log(`Updating user ${savedUser.id} with active_account_id ${activeAccountId} after finding existing accounts...`);
                    const { error: updateActiveAccountError } = await supabaseAdmin
                      .from('users')
                      .update({ active_account_id: activeAccountId })
                      .eq('id', savedUser.id);

                    if (updateActiveAccountError) {
                      console.error('Error updating user with active_account_id after finding existing accounts:', updateActiveAccountError);
                      throw new Error(`Failed to update user with active_account_id: ${updateActiveAccountError.message}`);
                    } else {
                       console.log(`User ${savedUser.id} updated successfully with active_account_id ${activeAccountId}`);
                    }
                }

            } else {
            // --- End: New check for existing accounts ---
              // If no accounts found for this user, this is the true first-time sign-in setup.
              console.log(`No existing accounts found for user ${savedUser.id}. Proceeding with primary account creation.`);

              // Use a more robust approach: try to create account, if it fails due to duplicate, fetch existing
              let primaryAccount = null;
              let activeAccountDetails = null;

              try {
                console.log(`Creating primary account for user ${savedUser.id}...`);
                
                // Add longer delay to ensure database transaction is committed
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try using raw SQL to bypass any ORM issues
                console.log('Using raw SQL approach to create account...');
                
                let newAccount = null;
                let createError = null;
                
                try {
                  const sqlResult = await supabaseAdmin
                    .rpc('exec_sql', {
                      sql: `
                        INSERT INTO accounts (owner_id, name, account_type, created_at, updated_at)
                        SELECT $1, $2, $3, NOW(), NOW()
                        WHERE EXISTS (SELECT 1 FROM users WHERE id = $1)
                        RETURNING *;
                      `,
                      params: [savedUser.id, user.name || 'Primary Account', 'google']
                    });
                  
                  newAccount = sqlResult.data;
                  createError = sqlResult.error;
                  console.log('Raw SQL result:', { newAccount, createError });
                } catch (sqlError) {
                  console.log('Raw SQL not available, using direct insert...', sqlError.message);
                  createError = sqlError;
                }
                
                // If raw SQL doesn't work, fall back to direct insert
                if (createError && createError.message?.includes('function')) {
                  console.log('Using direct insert fallback...');
                  const directResult = await supabaseAdmin
                    .from('accounts')
                    .insert({
                      owner_id: savedUser.id,
                      name: user.name || 'Primary Account',
                      account_type: 'google',
                    })
                    .select()
                    .single();
                  
                  newAccount = directResult.data;
                  createError = directResult.error;
                  console.log('Direct insert fallback result:', { newAccount, createError });
                }

                if (createError) {
                  // If creation failed, check if it's because account already exists
                  if (createError.code === '23505' || createError.message?.includes('duplicate')) {
                    console.log('Account creation failed due to duplicate, fetching existing account...');
                    
                    const { data: existingAccount, error: fetchError } = await supabaseAdmin
                      .from('accounts')
                      .select('*')
                      .eq('owner_id', savedUser.id)
                      .eq('account_type', 'google')
                      .single();
                    
                    if (!fetchError && existingAccount) {
                      primaryAccount = existingAccount;
                      console.log(`Using existing account: ${primaryAccount.id}`);
                    } else {
                      throw new Error(`Failed to create or fetch account: ${createError.message}`);
                    }
                  } else {
                    throw createError;
                  }
                } else {
                  primaryAccount = newAccount;
                  console.log(`Primary account created successfully: ${primaryAccount.id}`);
                }

                // Set account details
                activeAccountDetails = {
                  id: primaryAccount.id,
                  name: primaryAccount.name,
                  account_type: primaryAccount.account_type,
                };

              } catch (error) {
                console.error('Failed to create or fetch primary account:', error);
                throw new Error(`Failed to setup primary account: ${error.message}`);
              }

              activeAccountId = primaryAccount.id;

              // Update the user record with the new active_account_id
              console.log(`Updating user ${savedUser.id} with active_account_id ${activeAccountId}...`); // Log before update
              const { error: updateActiveAccountError } = await supabaseAdmin
                .from('users')
                .update({ active_account_id: activeAccountId })
                .eq('id', savedUser.id);

              if (updateActiveAccountError) {
                console.error('Error updating user with active_account_id:', updateActiveAccountError);
                 throw new Error(`Failed to update user with active_account_id: ${updateActiveAccountError.message}`);
              } else {
                  console.log(`User ${savedUser.id} updated successfully with active_account_id ${activeAccountId}`); // Log on successful update
              }

              console.log(`Primary account ${activeAccountId} created and set as active for user ${savedUser.id}`);

              // Update the savedUser object to reflect the new active_account_id
              savedUser.active_account_id = activeAccountId;
               // activeAccountDetails is already set from primaryAccount object after creation
            } // --- This closing brace matches the 'else' for 'existingAccounts.length > 0' ---


            // Ensure we have an active account ID before saving tokens
            if (!activeAccountId) {
                 console.error('Critical: No active account ID available after sign-in process for user:', savedUser.id);
                 throw new Error('Authentication failed: Could not determine active account.');
            }


            // Save tokens and get saved token data
            console.log(`Attempting to save tokens for user ${savedUser.id} and active account ${activeAccountId}...`); // Log before saving tokens
            const savedTokens = await saveUserTokens({
              authUserId: savedUser.id, // Pass authUserId
              accountId: activeAccountId, // Pass the active account ID
              email: user.email, // Use the email from the initial Google profile
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at
            });

             console.log(`saveUserTokens call completed.`); // Log after saving tokens


            if (!savedTokens || !savedTokens.access_token) {
              console.error('Failed to save or retrieve token data for user:', savedUser.id);
              throw new Error('Failed to save or retrieve token data');
            }

            console.log(`Tokens saved successfully for user ${savedUser.id} and active account ${activeAccountId}`);

            // Return the token with all required data
            return {
              ...token, // Keep existing token properties
              auth_user_id: savedUser.id, // Set the user's ID from public.users
              active_account_id: activeAccountId, // Set the active account ID
              // Include token data in the session token
              access_token: savedTokens.access_token,
              refresh_token: savedTokens.refresh_token,
              expires_at: savedTokens.expires_at,
              // Clear any previous errors
              error: null,
              // Expose user and active account details to the token
              user: { // Ensure user details are populated
                   id: savedUser.id,
                   email: savedUser.email,
                   name: savedUser.name,
                   image: savedUser.avatar_url,
               },
              account: activeAccountDetails || null, // Use the details fetched/created
            };
          }
        } catch (error) {
          console.error('JWT callback - Error during initial sign in or account handling:', error);
          // Set error on token and clear sensitive IDs on failure
          // Log the specific error code if available
          console.error('Error details:', {
              message: error.message,
              code: error.code, // Supabase errors often have a 'code'
              details: error.details,
              hint: error.hint,
          });
          token.error = error.message;
          delete token.auth_user_id;
          delete token.active_account_id;
          // Also clear account details on error
          delete token.user;
          delete token.account;
          return token;
        }
      }

      // Handle session updates (runs on subsequent requests, after initial sign-in)
      if (trigger === 'update' && token.email) {
        console.log('JWT callback - Session update triggered for:', token.email);
        try {
          // Get fresh user data from public.users to ensure auth_user_id and active_account_id are correct
          // and also fetch active account details
          const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, active_account_id, email, name, avatar_url, activeAccount: accounts(id, name, email, image, account_type)') // Fetch active account details via join/relation
            .eq('email', token.email)
            .single();

          if (userError || !userData) {
            // If user data fetching fails during update, log and clear user IDs from token
            console.error('JWT callback - Failed to get user data during session update:', userError?.message || 'User data not found');
            token.error = userError?.message || 'User data not found during session update';
            delete token.auth_user_id;
            delete token.active_account_id;
            delete token.user; // Clear user details
            delete token.account; // Clear account details
            return token;
          }

           // Check if active_account_id is still valid (exists in accounts table for this user)
           // This check might be redundant if the select query above correctly handles null/non-existent accounts
           // but can be added for robustness if needed.

          // Update token with fresh user and active account data
          return {
            ...token,
            auth_user_id: userData.id,
            active_account_id: userData.active_account_id,
            // Update user and account details in token
             user: {
                 id: userData.id,
                 email: userData.email,
                 name: userData.name,
                 image: userData.avatar_url,
             },
            account: userData.activeAccount || null, // Add active account details or null
            // Clear any previous errors if data fetched successfully
            error: null,
          };
        } catch (error) {
          console.error('JWT callback - Unexpected error during session update:', error);
          token.error = error.message;
          // Explicitly remove user IDs and details on unexpected error during update
          delete token.auth_user_id;
          delete token.active_account_id;
          delete token.user;
          delete token.account;
          return token;
        }
      }


      // If not initial sign-in and not an update trigger,
      // and if auth_user_id and active_account_id are already present,
      // ensure the user and account details are still in the token, refetching if necessary.
      // This helps keep session token consistent if it somehow loses these details
      // between requests without a full 'update' trigger.
      if (token.auth_user_id && token.active_account_id && (!token.user || !token.account)) {
          console.log('JWT callback - Token has user/account IDs but missing details, refetching...');
          try {
             const { data: userData, error: userError } = await supabaseAdmin
               .from('users')
               .select('id, active_account_id, email, name, avatar_url, activeAccount: accounts(id, name, email, image, account_type)')
               .eq('id', token.auth_user_id)
               .single();

             if (!userError && userData) {
                return {
                    ...token,
                    user: {
                       id: userData.id,
                       email: userData.email,
                       name: userData.name,
                       image: userData.avatar_url,
                    },
                    account: userData.activeAccount || null,
                    error: null, // Clear previous errors
                };
             } else {
                console.error('JWT callback - Failed to refetch user/account details:', userError?.message);
                // If refetch fails, clear IDs and set error to force re-auth
                token.error = userError?.message || 'Failed to refresh user/account details';
                delete token.auth_user_id;
                delete token.active_account_id;
                delete token.user;
                delete token.account;
                return token;
             }
          } catch (error) {
               console.error('JWT callback - Unexpected error during refetching user/account details:', error);
               token.error = error.message;
               delete token.auth_user_id;
               delete token.active_account_id;
               delete token.user;
               delete token.account;
               return token;
          }
      }


      // Return existing token if no updates needed
      console.log('JWT callback - Returning existing token.');
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client from the token
      session.accessToken = token.access_token;
      session.refreshToken = token.refresh_token;
      session.expiresAt = token.expires_at;
      session.error = token.error;
      session.authUserId = token.auth_user_id;
      session.activeAccountId = token.active_account_id;
      // Expose user and active account details to the client session
      session.user = token.user;
      session.activeAccount = token.account;

      // Add a helper to check if the user is fully authenticated and has an active account
       session.isAuthenticatedAndConfigured = Boolean(
           session.authUserId &&
           session.activeAccountId &&
           session.accessToken &&
           !session.error
       );

      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows for redirects to both the base URL and specific /home or /accounts pages
      if (url.startsWith(baseUrl)) return url;
      // Allow redirecting to /home or /accounts page explicitly after sign-in
      if (url.startsWith(`${baseUrl}/home`)) return url;
      if (url.startsWith(`${baseUrl}/accounts`)) return url;
      // Default redirect to home after successful sign-in if no other callbackUrl is specified
      // This logic might need adjustment based on your specific redirect requirements
       console.log(`Redirecting from ${url} to ${baseUrl}/home`);
       return `${baseUrl}/home`; // Default redirect to home

      // Prevent redirecting to arbitrary external URLs
      // return baseUrl; // Fallback to base URL for safety if the above doesn't match
    },
  },
  pages: {
    signIn: '/', // Redirect to homepage for sign-in
    signOut: '/', // Redirect to homepage after sign-out
    error: '/', // Redirect to homepage on authentication errors
    // You might want a dedicated error page: error: '/auth/error'
  },
  secret: process.env.NEXTAUTH_SECRET
};