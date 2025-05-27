import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Log limiting variables
const LOG_TIMESTAMPS = new Map();
const MIN_LOG_INTERVAL = 30000; // 30 seconds between similar logs

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
        .single();
      
      if (error || !userTokens) {
        throttledLog('Failed to get user tokens from database:', error, 'error');
        throw new Error('User tokens not found in database');
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
        const expiresAt = Math.floor(Date.now() / 1000 + expiryDate / 1000);
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
  try {
    if (!authUserId) {
      console.error('getValidAccessToken: Missing required parameter (authUserId)');
      return null;
    }

    console.log(`getValidAccessToken: Fetching token for Auth User ID: ${authUserId}, Account ID: ${accountId || 'N/A'}`);

    // Get user tokens from the session or, if available (but we're not counting on it), from the token store
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', authUserId)
      .single();

    if (userError || !user || !user.email) {
      console.error('getValidAccessToken: Error fetching user email:', userError?.message || 'User not found');
      return null;
    }

    const userEmail = user.email;
    console.log(`getValidAccessToken: Found user email: ${userEmail}`);

    // Fetch token data from the database based on user_email
    const { data: tokenData, error } = await supabase
      .from('user_tokens')
      .select('id, access_token, refresh_token, expires_at') // Select id as well for update
      .eq('user_email', userEmail)
      .single();

    if (error || !tokenData) {
      console.error('getValidAccessToken: Error fetching user tokens:', error?.message || 'User tokens not found for this account');
      return null;
    }

    // Check if the current access token is still valid
    if (tokenData.access_token && tokenData.expires_at) {
      const expiryTime = new Date(tokenData.expires_at * 1000); // Convert timestamp to Date
      // Add a safety margin of 5 minutes
      const safeExpiryTime = new Date(expiryTime.getTime() - 5 * 60 * 1000);

      if (safeExpiryTime > new Date()) {
        console.log(`getValidAccessToken: Existing access token is valid for account ${accountId}`);
        return tokenData.access_token;
      }
    }

    // Access token is expired or not available, attempt to refresh
    if (!tokenData.refresh_token) {
      console.error('getValidAccessToken: Refresh token not available for account:', accountId);
      // TODO: Handle this case - maybe prompt user to re-authenticate Google Drive for this account
      return null;
    }

    console.log(`getValidAccessToken: Access token expired, attempting refresh for account ${accountId}`);

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI // Or your redirect URI
    );

    // Check if client ID and secret are available
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('getValidAccessToken: Missing Google OAuth credentials in environment variables');
      return null;
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
      const expiresAt = Math.floor(Date.now() / 1000 + credentials.expires_in); // Store as Unix timestamp

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
        return null; // Return null if database update fails
      }

      console.log(`getValidAccessToken: Database updated with new token for account ${accountId}`);
      return accessToken; // Return the new valid access token

    } catch (refreshError) {
      console.error('getValidAccessToken: Error refreshing token with Google OAuth:', refreshError);

      // TODO: Implement more specific error handling for refresh errors
      // e.g., revoked access (invalid_grant), network errors, etc.
      // Based on the error, you might need to prompt the user to re-authenticate.

      return null; // Return null if token refresh fails
    }
  } catch (error) {
    console.error('getValidAccessToken: Unexpected error:', error);
    return null;
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