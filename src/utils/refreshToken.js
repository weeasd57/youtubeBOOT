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
    
    if (error || !userTokens || !userTokens.refresh_token) {
      console.error('Failed to get refresh token from database:', error);
      return null;
    }
    
    // Create OAuth client for refreshing
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL
    );
    
    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: userTokens.refresh_token
    });
    
    // Refresh the token
    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;
    const refreshToken = credentials.refresh_token || userTokens.refresh_token;
    const expiresAt = Math.floor(Date.now() / 1000 + credentials.expiry_date / 1000);
    
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
      accessToken,
      refreshToken,
      expiresAt
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return null;
  }
}

/**
 * Gets a valid Google OAuth access token, refreshing if necessary
 * @param {string} email User's email
 * @returns {Promise<string|null>} Valid access token or null if unavailable
 */
export async function getValidAccessToken(email) {
  try {
    // Get the user's tokens from the database
    const { data: userTokens, error } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_email', email)
      .single();
    
    if (error || !userTokens) {
      console.error('Failed to get tokens from database:', error);
      return null;
    }
    
    // Check if the token is expired (with 5 minute buffer)
    const isExpired = !userTokens.expires_at || 
      userTokens.expires_at < Math.floor(Date.now() / 1000) - 300;
    
    // If not expired, return the current token
    if (!isExpired && userTokens.access_token) {
      return userTokens.access_token;
    }
    
    // If expired, refresh the token
    const refreshedTokens = await refreshAccessToken(email);
    return refreshedTokens ? refreshedTokens.accessToken : null;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    return null;
  }
} 