import { getServerSession } from 'next-auth/next';
import { authOptions } from './app/api/auth/[...nextauth]/options';

/**
 * Function to get the current user's session on the server
 * Re-exports getServerSession from next-auth to simplify imports
 */
export async function auth() {
  return getServerSession(authOptions);
}

import { signIn, signOut, useSession } from 'next-auth/react';