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
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Get the user's email from the session
    const email = session.user.email;
    console.log(`Refreshing token for user: ${email}`);
    
    // Check and update global failure counter for this user
    const userKey = `${email}-failures`;
    let userFailures = failureCounters.get(userKey) || { count: 0, lastFailure: 0 };
    
    // If it's been a long time since the last failure, reset the counter
    if (Date.now() - userFailures.lastFailure > FAILURE_RESET_TIME) {
      userFailures = { count: 0, lastFailure: 0 };
    }
    
    // If user has exceeded max failures, force sign out
    if (userFailures.count >= MAX_FAILURES_BEFORE_SIGNOUT) {
      console.error(`User ${email} has had ${userFailures.count} token refresh failures - forcing sign out`);
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
    
    // Attempt to refresh the tokens with limited retries
    let retryCount = 0;
    let networkErrorCount = 0;
    let lastError = null;
    
    // Try up to 3 times with increasing delays
    while (retryCount < 3) {
      try {
        // Call the token refresh function
        const result = await refreshAccessToken(email);
        
        // Handle different response types
        if (result.success) {
          console.log('Refresh session successful, new token received');
          
          // Reset failure counter on success
          failureCounters.delete(userKey);
          
          // Return the new token information
          return NextResponse.json({
            success: true,
            message: 'Tokens refreshed successfully',
            tokenInfo: {
              accessToken: result.accessToken.substring(0, 10) + '...',
              expiresAt: result.expiresAt,
            }
          });
        }
        
        // Special handling for network errors
        if (result.errorCode === 'NETWORK_ERROR') {
          networkErrorCount++;
          console.warn(`Network error during token refresh (${networkErrorCount})`);
          
          // If we've had multiple network errors, break out of the loop to avoid infinite retries
          if (networkErrorCount >= 2) {
            // Increment the global failure counter
            userFailures.count++;
            userFailures.lastFailure = Date.now();
            failureCounters.set(userKey, userFailures);
            
            return NextResponse.json({
              success: false,
              message: 'Network connectivity issues detected',
              error: result.error,
              action: 'retry_later',
              retryAfter: 60, // Suggest waiting 60 seconds
              failureCount: userFailures.count,
              maxFailures: MAX_FAILURES_BEFORE_SIGNOUT
            }, { status: 503 });
          }
        }
        // Handle access revocation case
        else if (result.errorCode === 'ACCESS_REVOKED') {
          console.warn(`Access revoked for user ${email}, forcing sign out`);
          
          // Reset counter since user will need to sign in again
          failureCounters.delete(userKey);
          
          return NextResponse.json({
            success: false,
            message: 'Your access to Google has been revoked or expired. Please sign in again.',
            error: result.error,
            action: 'sign_out',
            forceSignOut: true
          }, { status: 401 });
        }
        else {
          // For regular token failures, throw an error to trigger retry
          throw new Error(result.error || 'Failed to refresh tokens');
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