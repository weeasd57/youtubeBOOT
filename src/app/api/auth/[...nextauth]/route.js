import NextAuth from 'next-auth';
import { authOptions } from './options';

// Create NextAuth handler with the imported options
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };