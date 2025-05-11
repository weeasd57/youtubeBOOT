import { google } from 'googleapis';
import { supabaseAdmin } from './supabase';

/**
 * Refreshes an expired Google OAuth access token using the refresh token
 * @param {string} email User's email to identify which tokens to refresh
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresAt: number} | null>}
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
      console.error('Failed to get user tokens from database:', error);
      throw new Error('User tokens not found in database');
    }
    
    if (!userTokens.refresh_token) {
      console.error('No refresh token found for user:', email);
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
      console.error('Missing Google OAuth credentials in environment variables');
      throw new Error('Missing Google OAuth credentials');
    }
    
    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: userTokens.refresh_token,
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube'
    });
    
    try {
      // Refresh the token
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      console.log('Token refreshed successfully with scopes:', credentials.scope);
      
      const accessToken = credentials.access_token;
      const refreshToken = credentials.refresh_token || userTokens.refresh_token;
      const expiryDate = credentials.expiry_date;
      const expiresAt = Math.floor(Date.now() / 1000 + expiryDate / 1000);
      
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
        expiresAt
      };
    } catch (refreshError) {
      console.error('Error refreshing token with Google OAuth:', refreshError);
      
      // Mark this token as invalid in the database
      await supabaseAdmin
        .from('user_tokens')
        .update({
          is_valid: false,
          error_message: refreshError.message,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', email);
      
      throw new Error(`Failed to refresh token: ${refreshError.message}`);
    }
  } catch (error) {
    console.error('Error in refreshAccessToken:', error);
    
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
    // تسجيل محاولة الحصول على الرمز
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
    
    // التحقق من حالة الصلاحية المخزنة في قاعدة البيانات
    if (userTokens.is_valid === false) {
      console.warn(`User ${email} has invalid tokens stored. Attempting to refresh anyway.`);
    }
    
    // Check if the token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const isExpired = !userTokens.expires_at || userTokens.expires_at < now - 300;
    
    // If not expired, return the current token
    if (!isExpired && userTokens.access_token) {
      console.log(`User ${email} has a valid token that expires in ${userTokens.expires_at - now} seconds`);
      return userTokens.access_token;
    }
    
    // Token needs refresh
    console.log(`Token for user ${email} is expired or missing, refreshing...`);
    
    // If expired, refresh the token
    const refreshResult = await refreshAccessToken(email);
    
    if (!refreshResult.success) {
      console.error(`Failed to refresh token for ${email}:`, refreshResult.error);
      throw new Error(refreshResult.error || 'Failed to refresh access token');
    }
    
    console.log(`Successfully refreshed token for ${email}`);
    return refreshResult.accessToken;
  } catch (error) {
    console.error(`Error getting valid access token for ${email}:`, error);
    throw error;
  }
} 