import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { refreshUserTokens } from '@/utils/refreshToken';

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
    
    // Attempt to refresh the tokens with multiple retries
    let retryCount = 0;
    let lastError = null;
    
    // Try up to 3 times with increasing delays
    while (retryCount < 3) {
      try {
        // Call the token refresh function
        const { success, accessToken, refreshToken, expiryDate } = await refreshUserTokens(email);
        
        if (!success) {
          throw new Error('Failed to refresh tokens');
        }
        
        console.log('Refresh session successful, new token received');
        
        // Return the new token information
        return NextResponse.json({
          success: true,
          message: 'Tokens refreshed successfully',
          tokenInfo: {
            accessToken: accessToken.substring(0, 10) + '...',
            expiresAt: expiryDate,
          }
        });
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
    
    // All retries failed
    console.error('Failed to refresh tokens after multiple attempts:', lastError);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to refresh tokens after multiple attempts',
        error: lastError?.message || 'Unknown error'
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