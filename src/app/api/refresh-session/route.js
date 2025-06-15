import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { refreshAccessToken } from '@/utils/refreshToken';

// Global counters to track failures (will reset on server restart)
const failureCounters = new Map();
const MAX_FAILURES_BEFORE_SIGNOUT = 5;
const FAILURE_RESET_TIME = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * API endpoint to refresh a user's OAuth tokens
 * This is used when a token expires and we need to get a new one
 */
export async function GET() {
  console.log('Refresh session endpoint called');
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.auth_user_id || !session.active_account_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
        hasActiveAccountId: !!session?.active_account_id
      });
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the user's auth ID and account ID from the session
    const authUserId = session.user.auth_user_id;
    const activeAccountId = session.active_account_id;
    const email = session.user?.email || 'unknown';
    console.log(`Refreshing token for Auth User ID: ${authUserId}, Account ID: ${activeAccountId}, Email: ${email}`);
    
    // Check and update global failure counter for this user
    const userKey = `${authUserId}-${activeAccountId}-failures`;
    let userFailures = failureCounters.get(userKey) || { count: 0, lastFailure: 0 };
    
    // If it's been a long time since the last failure, reset the counter
    if (Date.now() - userFailures.lastFailure > FAILURE_RESET_TIME) {
      userFailures = { count: 0, lastFailure: 0 };
    }
    
    // If user has exceeded max failures, force sign out
    if (userFailures.count >= MAX_FAILURES_BEFORE_SIGNOUT) {
      console.error(`User ${authUserId} account ${activeAccountId} has had ${userFailures.count} token refresh failures - forcing sign out`);
      return NextResponse.json(
        {
          success: false,
          message: 'Too many token refresh failures. Please sign in again.',
          action: 'sign_out',
          forceSignOut: true
        },
        { status: 401 }
      );
    }
    
    // Import the new getValidAccessToken function
    const { getValidAccessToken } = await import('@/utils/refreshToken');
    
    // Attempt to get a valid access token (this will refresh if needed)
    let retryCount = 0;
    let networkErrorCount = 0;
    let lastError = null;
    
    // Try up to 3 times with increasing delays
    while (retryCount < 3) {
      try {
        // Call the token validation/refresh function
        const result = await getValidAccessToken(authUserId, activeAccountId);
        const accessToken = result?.accessToken;
        const tokenError = result?.error;
        
        // Handle successful token retrieval
        if (accessToken) {
          console.log('Refresh session successful, valid token obtained');
          
          // Reset failure counter on success
          failureCounters.delete(userKey);
          
          // Return the success information
          return NextResponse.json({
            success: true,
            message: 'Tokens refreshed successfully',
            tokenInfo: {
              accessToken: accessToken.substring(0, 10) + '...',
              authUserId: authUserId,
              activeAccountId: activeAccountId
            }
          });
        }
        
        if (!result || tokenError || !accessToken) {
          // If no access token was returned, treat as an error
          throw new Error(tokenError || 'Failed to obtain valid access token');
        }
      } catch (error) {
        lastError = error;
        retryCount++;
        
        // Don't wait on the last retry, just fail
        if (retryCount < 3) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, retryCount - 1) * 1000;
          console.log(`Token refresh attempt ${retryCount} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed - increment the global failure counter
    userFailures.count++;
    userFailures.lastFailure = Date.now();
    failureCounters.set(userKey, userFailures);
    
    // All retries failed
    console.error('Failed to refresh tokens after multiple attempts:', lastError);
    
    // Check if we need to trigger re-authentication
    const needsReauth = lastError?.message?.includes('invalid_grant') || 
                        lastError?.message?.includes('Invalid Credentials');
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to refresh tokens after multiple attempts',
        error: lastError?.message || 'Unknown error',
        action: needsReauth ? 'sign_out' : 'retry_later',
        failureCount: userFailures.count,
        maxFailures: MAX_FAILURES_BEFORE_SIGNOUT
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in refresh-session endpoint:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error refreshing session',
        error: error.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}