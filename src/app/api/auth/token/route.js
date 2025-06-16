import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';
import { getValidAccessToken } from '@/utils/refreshToken';

/**
 * API endpoint to get a valid access token for a specific account
 * This endpoint is used by the DriveContext to get tokens for API calls
 */
export async function GET(request) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    // No session - user isn't logged in
    if (!session) {
      console.error("Token endpoint: No active session found");
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Get parameters from the request
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) {
      console.error("Token endpoint: No accountId provided");
      return NextResponse.json({ error: 'Missing accountId parameter' }, { status: 400 });
    }
    
    // Get auth user ID from session
    const authUserId = session.user?.auth_user_id;
    
    if (!authUserId) {
      console.error("Token endpoint: No auth_user_id in session");
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    
    console.log(`Getting a valid access token for accountId: ${accountId}`);
    
    // Get a valid token using the utility function
    const token = await getValidAccessToken(authUserId, accountId);
    
    if (!token) {
      console.error(`Failed to get valid token for account ${accountId}`);
      return NextResponse.json({ error: 'Failed to get valid token' }, { status: 500 });
    }
    
    // Return the token
    return NextResponse.json({
      token,
      accountId,
      authUserId
    });
  } catch (error) {
    console.error("Error in token endpoint:", error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
} 