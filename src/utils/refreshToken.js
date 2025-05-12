import { google } from 'googleapis';
import { supabaseAdmin } from './supabase';

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
  try {
    // Get the user's tokens from the database
    const { data: userTokens, error } = await supabaseAdmin
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
      
      throttledLog('Token refreshed successfully with scopes:', credentials.scope);
      
      const accessToken = credentials.access_token;
      const refreshToken = credentials.refresh_token || userTokens.refresh_token;
      const expiryDate = credentials.expiry_date;
      const expiresAt = Math.floor(Date.now() / 1000 + expiryDate / 1000);
      const scopes = credentials.scope;
      
      // Update the tokens in the database
      await supabaseAdmin
        .from('user_tokens')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
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
        await supabaseAdmin
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
      await supabaseAdmin
        .from('user_tokens')
        .update({
          error_message: refreshError.message,
          updated_at: new Date().toISOString(),
          last_network_error: isNetworkError ? new Date().toISOString() : null
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
          isNetworkError: true
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
    throttledLog('Error in refreshAccessToken:', error, 'error');
    
    // Return structured error response
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Gets a valid Google OAuth access token, refreshing if necessary
 * @param {string} email User's email
 * @returns {Promise<string|null>} Valid access token or null if unavailable
 */
export async function getValidAccessToken(email) {
  try {
    // Log attempt to get valid token
    console.log(`Attempting to get valid access token for user: ${email}`);
    
    // Get the user's tokens from the database
    const { data: userTokens, error } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_email', email)
      .single();
    
    if (error) {
      console.error('Failed to get tokens from database:', error);
      throw new Error(`Database error: ${error.message}`);
    }
    
    if (!userTokens) {
      console.error('No tokens found for user:', email);
      throw new Error('No authentication tokens found for this user');
    }
    
    // Check if the token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const isExpired = !userTokens.expires_at || userTokens.expires_at < now - 300;
    
    // If token is not expired and we have a token, use it
    if (!isExpired && userTokens.access_token) {
      console.log(`Using existing valid token for ${email} that expires in ${userTokens.expires_at - now} seconds`);
      
      // Log scopes if available for debugging
     
      return userTokens.access_token;
    }
    
    // Token needs refresh - either expired or missing
    console.log(`Token for user ${email} needs refresh (expired: ${isExpired})`);
    
    // Refresh the token
    const refreshResult = await refreshAccessToken(email);
    
    if (!refreshResult.success) {
      // Check if access was revoked
      if (refreshResult.errorCode === 'ACCESS_REVOKED') {
        console.error(`Access revoked for user ${email}, token deleted`);
        throw new Error('Access revoked. Please sign in again to reconnect your Google account.');
      }
      
      // Other errors
      console.error(`Failed to refresh token for ${email}:`, refreshResult.error);
      throw new Error(refreshResult.error || 'Failed to refresh access token');
    }
    
    console.log(`Successfully refreshed token for ${email}`);
    
    // Update scopes in database if available
    if (refreshResult.scopes) {
      console.log(`Received scopes from refresh: ${refreshResult.scopes}`);
      await supabaseAdmin
        .from('user_tokens')
        .update({
          scopes: refreshResult.scopes,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', email);
    } else {
      console.log('No scopes received from token refresh');
    }
    
    return refreshResult.accessToken;
  } catch (error) {
    console.error(`Error getting valid access token for ${email}:`, error);
    throw error;
  }
} 