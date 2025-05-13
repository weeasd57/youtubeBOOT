import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';
import { refreshAccessToken } from '@/utils/refreshToken';

// API endpoint to refresh a user's token
export async function POST() {
  try {
    // Get the user's session
    const session = await getServerSession(authOptions);
    
    // Check if the user is authenticated
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    // Refresh the token
    const result = await refreshAccessToken(session.user.email);

    // Handle successful refresh
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Authentication refreshed successfully'
      });
    } 
    
    // Handle retry information
    if (result.retryAttempts > 0) {
      return NextResponse.json({
        success: false,
        message: `Authentication refresh failed after ${result.retryAttempts} retry attempts. ${result.error || ''}`,
        retryAttempts: result.retryAttempts,
        error: result.error,
        errorCode: result.errorCode
      }, { status: 400 });
    }
    
    // Handle network errors specifically
    if (result.isNetworkError) {
      return NextResponse.json({
        success: false,
        message: 'Network error occurred while refreshing authentication. Please check your connection and try again.',
        isNetworkError: true,
        error: result.error,
        errorCode: result.errorCode
      }, { status: 503 });
    }
    
    // Handle revoked access
    if (result.errorCode === 'ACCESS_REVOKED') {
      return NextResponse.json({
        success: false,
        message: 'Your access to Google services has been revoked. Please sign in again to reconnect your account.',
        needsReauth: true,
        error: result.error,
        errorCode: result.errorCode
      }, { status: 401 });
    }
    
    // Handle other errors
    return NextResponse.json({
      success: false,
      message: result.error || 'Failed to refresh authentication',
      error: result.error,
      errorCode: result.errorCode
    }, { status: 400 });
  } catch (error) {
    console.error('Error in auth refresh API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Server error during authentication refresh',
        error: error.message 
      },
      { status: 500 }
    );
  }
} 