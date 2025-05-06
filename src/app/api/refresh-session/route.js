import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

// Endpoint to refresh the user's session when tokens expire
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    // Get a valid access token, refreshing if needed
    const accessToken = await getValidAccessToken(session.user.email);
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        message: 'Failed to refresh access token',
        action: 'sign_out'
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Session refreshed successfully'
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