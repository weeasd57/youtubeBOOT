import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';
import { refreshAccessToken } from '@/utils/refreshToken';

export async function POST(req) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ 
        success: false, 
        message: 'Not authenticated' 
      }, { status: 401 });
    }
    
    // Refresh the access token
    const refreshResult = await refreshAccessToken(session.user.email);
    
    if (!refreshResult || !refreshResult.success) {
      return NextResponse.json({ 
        success: false, 
        message: refreshResult?.error || 'Failed to refresh token',
        needsReauth: refreshResult?.needsReauth || false
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Authentication refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing authentication:', error);
    return NextResponse.json({
      success: false,
      message: 'Error refreshing authentication: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
} 