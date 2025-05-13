import { google } from 'googleapis';

/**
 * Creates a Google OAuth2 client from an access token
 * 
 * @param {string} accessToken - The OAuth access token
 * @returns {OAuth2Client} - Google OAuth2 client
 */
export function getGoogleAuthFromToken(accessToken) {
  if (!accessToken) {
    throw new Error('Access token is required');
  }
  
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });
  
  return oauth2Client;
}

/**
 * Gets Google OAuth2 client scope configuration
 * 
 * @returns {Array<string>} - Array of required Google API scopes
 */
export function getGoogleScopes() {
  return [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
  ];
}

/**
 * Formats user friendly error message for Google API errors
 * 
 * @param {Error} error - The error object from Google API
 * @returns {string} - User-friendly error message
 */
export function formatGoogleError(error) {
  if (!error) return 'Unknown error';
  
  // Handle Google API specific errors
  if (error.errors && Array.isArray(error.errors)) {
    const firstError = error.errors[0];
    if (firstError.reason) {
      switch (firstError.reason) {
        case 'rateLimitExceeded':
          return 'Rate limit exceeded. Please try again later.';
        case 'userRateLimitExceeded':
          return 'You have reached your request limit. Please try again later.';
        case 'dailyLimitExceeded':
          return 'Daily quota exceeded. Please try again tomorrow.';
        case 'insufficientPermissions':
        case 'insufficientFilePermissions':
          return 'Insufficient permissions. Please check your Google Drive permissions.';
        case 'notFound':
          return 'The requested file or folder was not found.';
        default:
          return firstError.message || `Error: ${firstError.reason}`;
      }
    }
  }
  
  // Handle OAuth errors
  if (error.message) {
    if (error.message.includes('invalid_grant')) {
      return 'Session expired. Please sign in again.';
    }
    
    if (error.message.includes('unauthorized_client')) {
      return 'Authorization error. Please sign in again.';
    }
    
    return error.message;
  }
  
  return 'An error occurred with Google Drive. Please try again.';
} 