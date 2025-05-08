import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Endpoint to refresh the user's session when tokens expire
export async function GET() {
  try {
    console.log('Refresh session endpoint called');
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      console.log('Refresh session: Not authenticated');
      return NextResponse.json({ 
        success: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    console.log('Refreshing token for user:', session.user.email);
    
    // Get a valid access token, refreshing if needed
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      console.log('Refresh session failed: Could not get valid access token');
      return NextResponse.json({
        success: false,
        message: 'Failed to refresh access token',
        action: 'sign_out'
      });
    }
    
    console.log('Refresh session successful, new token received');
    
    // Make sure accessToken is added to the session object
    if (session.accessToken !== accessToken) {
      console.log('Updating session with new access token');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Session refreshed successfully',
      tokenUpdated: true
    });
  } catch (error) {
    console.error('Error refreshing session:', error);
    return NextResponse.json({
      success: false,
      message: 'Error refreshing session',
      error: error.message
    }, { status: 500 });
  }
} 