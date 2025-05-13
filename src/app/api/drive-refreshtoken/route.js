import { google } from 'googleapis';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';

// Direct token refresh that bypasses Supabase
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.error("No session found for token refresh");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!session.user?.email) {
      console.error("Session exists but no user email found");
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }
    
    // Check for force parameter
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    // Only proceed with direct refresh if forced or no token is present
    if (!force && session.accessToken) {
      return NextResponse.json({ 
        success: true, 
        message: 'Using existing token',
        accessToken: session.accessToken
      });
    }
    
    console.log(`Attempting direct token refresh for ${session.user.email}`);
    
    // Create OAuth client for refreshing
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL
    );
    
    // Set the refresh token
    if (!session.refreshToken) {
      return NextResponse.json({ 
        error: 'No refresh token available',
        needsReauth: true
      }, { status: 400 });
    }
    
    oauth2Client.setCredentials({
      refresh_token: session.refreshToken
    });
    
    // Refresh the token directly
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log('Token refreshed successfully with direct method');
    
    // Update the session (this won't persist, but can be used for this request)
    session.accessToken = credentials.access_token;
    if (credentials.refresh_token) {
      session.refreshToken = credentials.refresh_token;
    }
    
    return NextResponse.json({
      success: true,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || session.refreshToken
    });
  } catch (error) {
    console.error('Error in direct token refresh:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error refreshing token',
      errorCode: 'REFRESH_ERROR'
    }, { status: 500 });
  }
} 