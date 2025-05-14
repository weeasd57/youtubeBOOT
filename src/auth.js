import { getServerSession } from 'next-auth/next';
import { authOptions } from './app/api/auth/[...nextauth]/options';

/**
 * Function to get the current user's session on the server
 * Re-exports getServerSession from next-auth to simplify imports
 */
export async function auth() {
  return getServerSession(authOptions);
}

export function getUser() {
  // Basic mock implementation
  return {
    id: '1',
    name: 'Demo User',
    email: 'user@example.com',
    image: 'https://i.pravatar.cc/150?img=3'
  };
}

export function signIn() {
  // Mock implementation
  return Promise.resolve({ user: getUser() });
}

export function signOut() {
  // Mock implementation
  return Promise.resolve(true);
}

export function useSession() {
  // Mock implementation
  return {
    data: {
      user: getUser()
    },
    status: 'authenticated'
  };
} 