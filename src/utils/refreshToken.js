import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Log limiting variables
const LOG_TIMESTAMPS = new Map();
const MIN_LOG_INTERVAL = 30000; // 30 seconds between similar logs

// In-memory store for pending token refresh promises to deduplicate requests
const pendingTokenRefreshes = new Map(); // Key: `${authUserId}-${accountId}`, Value: Promise

/**
 * Controlled logging function that limits repeated logs
 * @param {string} message - Log message
 * @param {object} data - Additional data to log
 * @param {string} level - Log level ('log', 'error', 'warn')
 */
function throttledLog(message, data = null, level = 'log') {
  // Create a hash of the message to track frequency
  const messageKey = `${level}-${message}`;
  const now = Date.now();
  const lastLog = LOG_TIMESTAMPS.get(messageKey) || 0;
  
  // Check if we've logged this message recently
  if (now - lastLog > MIN_LOG_INTERVAL) {
    // If not logged recently, log it and update timestamp
    if (level === 'error') {
      console.error(message, data || '');
    } else if (level === 'warn') {
      console.warn(message, data || '');
    } else {
      console.log(message, data || '');
    }
    LOG_TIMESTAMPS.set(messageKey, now);
  }
}

/**
 * Refreshes an expired Google OAuth access token using the refresh token
 * @param {string} email User's email to identify which tokens to refresh
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number, scopes: string} | null>}
 */
export async function refreshAccessToken(email) {
  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2 second initial delay
  let retryCount = 0;
  let lastError = null;

  // Helper function to wait between retries with exponential backoff
  const wait = (attemptNumber) => {
    const delay = RETRY_DELAY_MS * Math.pow(1.5, attemptNumber);
    return new Promise(resolve => setTimeout(resolve, delay));
  };

  while (retryCount <= MAX_RETRIES) {
    try {
      // Get the user's tokens from the database
      const { data: userTokens, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('user_email', email)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error || !userTokens) {
        throttledLog('Failed to get user tokens from database:', error, 'error');
        // If maybeSingle returns null because no records match, userTokens will be null.
        // We should treat this as an error as we expect a token.
        if (!userTokens) {
          throw new Error('User tokens not found in database for email: ' + email);
        } else {
          throw new Error(`Error fetching user tokens: ${error.message}`);
        }
      }
      
      if (!userTokens.refresh_token) {
        throttledLog('No refresh token found for user:', email, 'error');
        throw new Error('No refresh token available for this user');
      }
      
      // Create OAuth client for refreshing
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.NEXTAUTH_URL
      );
      
      // Check if client ID and secret are available
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throttledLog('Missing Google OAuth credentials in environment variables', null, 'error');
        throw new Error('Missing Google OAuth credentials');
      }
      
      // Set the refresh token
      oauth2Client.setCredentials({
        refresh_token: userTokens.refresh_token,
        // Don't set scope here to avoid scope conflicts
      });
      
      try {
        // Refresh the token
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // If we got here after retries, log success
        if (retryCount > 0) {
          throttledLog(`Token refreshed successfully after ${retryCount} retries`);
        } else {
          throttledLog('Token refreshed successfully with scopes:', credentials.scope);
        }
        
        const accessToken = credentials.access_token;
        const refreshToken = credentials.refresh_token || userTokens.refresh_token;
        const expiryDate = credentials.expiry_date;
        const expiresAt = Math.floor(credentials.expiry_date / 1000);
        const scopes = credentials.scope;
        
        // Update the tokens in the database
        await supabase
          .from('user_tokens')
          .update({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
            retry_count: 0, // Reset retry count on success
            last_success: new Date().toISOString()
          })
          .eq('user_email', email);
        
        return {
          success: true,
          accessToken,
          refreshToken,
          expiresAt,
          scopes
        };
      } catch (refreshError) {
        lastError = refreshError;
        
        // Check for network timeouts specifically
        const isNetworkTimeout = 
          refreshError.code === 'ETIMEDOUT' || 
          refreshError.errno === 'ETIMEDOUT' ||
          (refreshError.message && refreshError.message.includes('ETIMEDOUT'));
        
        if (isNetworkTimeout && retryCount < MAX_RETRIES) {
          retryCount++;
          throttledLog(`Network timeout (ETIMEDOUT) when refreshing token. Retry ${retryCount}/${MAX_RETRIES}`, null, 'warn');
          
          // Update database with retry information
          await supabase
            .from('user_tokens')
            .update({
              error_message: `ETIMEDOUT - Retry ${retryCount}/${MAX_RETRIES}`,
              updated_at: new Date().toISOString(),
              retry_count: retryCount
            })
            .eq('user_email', email);
          
          // Wait before retry with exponential backoff
          await wait(retryCount);
          continue; // Skip to next iteration of the loop
        }
        
        throttledLog('Error refreshing token with Google OAuth:', refreshError, 'error');
        
        // Check if error is due to revoked access
        const isRevokedAccess = refreshError.message && (
          refreshError.message.includes('invalid_grant') || 
          refreshError.message.includes('invalid_request') ||
          refreshError.message.includes('access_denied') ||
          refreshError.message.includes('unauthorized_client')
        );
        
        // Identify network errors specifically
        const isNetworkError = 
          refreshError.code === 'ETIMEDOUT' || 
          refreshError.code === 'ECONNREFUSED' ||
          refreshError.code === 'ENOTFOUND' ||
          refreshError.errno === 'ETIMEDOUT' ||
          refreshError.type === 'system' ||
          (refreshError.message && (
            refreshError.message.includes('network') ||
            refreshError.message.includes('timeout') ||
            refreshError.message.includes('failed, reason:') ||
            refreshError.message.includes('ETIMEDOUT')
          ));
        
        if (isRevokedAccess) {
          throttledLog('User has likely revoked access:', email, 'warn');
          
          // Delete token from the database
          await supabase
            .from('user_tokens')
            .delete()
            .eq('user_email', email);
          
          return {
            success: false,
            error: "Access has been revoked. Please sign in again.",
            errorCode: "ACCESS_REVOKED",
            needsReauth: true
          };
        }
        
        // Mark token status in database based on error type
        await supabase
          .from('user_tokens')
          .update({
            error_message: refreshError.message,
            updated_at: new Date().toISOString(),
            last_network_error: isNetworkError ? new Date().toISOString() : null,
            retry_count: retryCount
          })
          .eq('user_email', email);
        
        // For network errors, we should still return the existing token if available
        if (isNetworkError) {
          throttledLog('Network error when refreshing token, using existing token if available', null, 'warn');
          
          // Return the existing token if we have one
          if (userTokens.access_token) {
            return {
              success: true,
              accessToken: userTokens.access_token,
              refreshToken: userTokens.refresh_token,
              expiresAt: userTokens.expires_at || Math.floor(Date.now() / 1000) + 3600, // Default 1 hour expiry
              scopes: userTokens.scopes
            };
          }
          
          return {
            success: false,
            error: "Network error when contacting Google's authentication servers",
            errorCode: "NETWORK_ERROR",
            isNetworkError: true,
            retryAttempts: retryCount
          };
        }
        
        // For other errors that are not network or access revocation related
        return {
          success: false,
          error: `Failed to refresh token: ${refreshError.message}`,
          errorCode: "REFRESH_ERROR"
        };
      }
    } catch (error) {
      lastError = error;
      
      if (retryCount < MAX_RETRIES) {
        // Retry on database errors too
        retryCount++;
        throttledLog(`Error in refreshAccessToken flow. Retry ${retryCount}/${MAX_RETRIES}: ${error.message}`, null, 'warn');
        await wait(retryCount);
        continue;
      }
      
      throttledLog('Error in refreshAccessToken after all retries:', error, 'error');
      
      // Return structured error response
      return {
        success: false,
        error: error.message,
        retryAttempts: retryCount
      };
    }
  }
  
  // If we've exhausted all retries and still failed
  return {
    success: false,
    error: `Failed to refresh token after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`,
    errorCode: "MAX_RETRIES_EXCEEDED",
    retryAttempts: retryCount
  };
}

/**
 * Gets a valid Google OAuth access token, refreshing if necessary
 * @param {string} email User's email
 * @returns {Promise<string|null>} Valid access token or null if unavailable
 */
export async function getValidAccessToken(authUserId, accountId) {
  const effectiveAccountId = accountId || authUserId;
  const requestKey = `token-refresh-${effectiveAccountId}`;

  try {
    if (!effectiveAccountId) {
      console.error('getValidAccessToken: Missing required parameter (authUserId or accountId)');
      return { success: false, error: 'Missing required parameter (authUserId or accountId)' };
    }

    // If there's an ongoing refresh for this key, await it
    if (pendingTokenRefreshes.has(requestKey)) {
      return await pendingTokenRefreshes.get(requestKey);
    }

    // Fetch token data from the database. First try by `account_id`, then fallback to primary `id`
    const { data: tokenData, error } = await supabase
      .from('user_tokens')
      .select('id, account_id, access_token, refresh_token, expires_at')
      // Supabase `or` filter lets us try multiple columns in a single query
      .or(`account_id.eq.${effectiveAccountId},id.eq.${effectiveAccountId}`)
      .maybeSingle(); // Expect one or zero tokens for a given account ID

    if (error || !tokenData) {
      console.error('getValidAccessToken: Error fetching user tokens:', error?.message || 'User tokens not found for this account');
      // If maybeSingle returns null because no records match, tokenData will be null.
      // We should return null in this case as no token was found.
      if (!tokenData) {      return { success: false, error: 'No user token found for this account' };
    } else {
      return { success: false, error: error?.message || 'Failed to fetch user token' };
    }
  }

  // Check if the current access token is still valid
    if (tokenData.access_token && tokenData.expires_at) {
      const expiryTime = new Date(tokenData.expires_at * 1000); // Convert timestamp to Date
      // Add a safety margin of 5 minutes
      const safeExpiryTime = new Date(expiryTime.getTime() - 5 * 60 * 1000);

      if (safeExpiryTime > new Date()) {
        return { success: true, accessToken: tokenData.access_token };
      }
    }

    // Access token is expired or not available, attempt to refresh
    if (!tokenData.refresh_token) {
      console.error('getValidAccessToken: Refresh token not available for account:', accountId);
      // TODO: Handle this case - maybe prompt user to re-authenticate Google Drive for this account
      return { success: false, error: 'Refresh token not available. Please re-authenticate.' };
    }

    console.log(`getValidAccessToken: Access token expired, attempting refresh for account ${accountId}`);

    // Create a new promise for the refresh operation and store it
    const refreshPromise = (async () => {
      // Initialize OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI // Or your redirect URI
      );

      // Check if client ID and secret are available
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('getValidAccessToken: Missing Google OAuth credentials in environment variables');
        return { success: false, error: 'Missing Google OAuth credentials' };
      }

      // Set the refresh token
      oauth2Client.setCredentials({
        refresh_token: tokenData.refresh_token,
      });

      try {
        // Refresh the token
        const { credentials } = await oauth2Client.refreshAccessToken();

        console.log(`getValidAccessToken: Token refreshed successfully for account ${accountId}`);

        const accessToken = credentials.access_token;
        const refreshToken = credentials.refresh_token || tokenData.refresh_token; // Use new refresh token if provided
        const expiresAt = Math.floor(credentials.expiry_date / 1000);

        // Update the tokens in the database using the token record ID
        const { error: updateError } = await supabase
          .from('user_tokens')
          .update({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
            // Reset retry count or error flags if you have them
          })
          .eq('id', tokenData.id); // Update using the fetched record ID

        if (updateError) {
          console.error('getValidAccessToken: Error updating tokens in database:', updateError.message);
          // Decide how to handle this error - maybe log and continue, or return null
          return { success: false, error: `Failed to update token in DB: ${updateError.message}` }; // Return null if database update fails
        }

        console.log(`getValidAccessToken: Database updated with new token for account ${accountId}`);
        return { success: true, accessToken }; // Return the new valid access token

      } catch (refreshError) {
        console.error('getValidAccessToken: Error refreshing token with Google OAuth:', refreshError);
        return { success: false, error: refreshError.message || 'Failed to refresh token' }; // Return null if token refresh fails
      } finally {
        // Ensure the promise is removed from the map after completion (success or failure)
        pendingTokenRefreshes.delete(requestKey);
      }
    })();

    pendingTokenRefreshes.set(requestKey, refreshPromise);
    const result = await refreshPromise;
    return result;

  } catch (error) {
    console.error('getValidAccessToken: Unexpected error:', error);
    // Ensure the promise is removed from the map if an unexpected error occurs outside the refreshPromise
    // This might require re-thinking if `requestKey` is defined here in the outer catch.
    // For now, it's generally safer to remove it within the refreshPromise's finally block.
    if (pendingTokenRefreshes.has(requestKey)) {
        pendingTokenRefreshes.delete(requestKey);
    }
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

// التحقق من صلاحية رمز الوصول مباشرة مع Google API
export async function validateToken(accessToken) {
  try {
    if (!accessToken) return false;

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2'
    });

    // استعلام عن معلومات المستخدم للتحقق من صلاحية الرمز
    await oauth2.userinfo.get();
    return true;
  } catch (error) {
    // خطأ يعني أن الرمز غير صالح
    return false;
  }
}

