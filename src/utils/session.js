import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

/**
 * Get the current session for the authenticated user
 * @returns {Promise<Object|null>} The session object or null if not authenticated
 */
export async function getSession() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      console.log('No session found');
      return null;
    }
    
    return {
      authUserId: session.authUserId,
      activeAccountId: session.activeAccountId,
      user: session.user,
      provider: session.provider,
      accessToken: session.accessToken
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
} 