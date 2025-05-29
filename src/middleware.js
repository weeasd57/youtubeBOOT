import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  // `withAuth` augments your Next.js Request with the user's token.
  function middleware(req) {
    // Handle adding account flow
    if (req.nextUrl.pathname === '/accounts' && req.nextUrl.searchParams.has('addingFor')) {
      const addingFor = req.nextUrl.searchParams.get('addingFor');
      // Set cookie to remember we're adding an account for this user
      const response = NextResponse.next();
      response.cookies.set('addingAccountFor', addingFor, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 5 // 5 minutes
      });
      return response;
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // console.log("authorized callback token:", token);
        // return true if the user is authorized
        // For now, just check if token exists
        return !!token;
      },
    },
    pages: {
      signIn: '/', // Redirect unauthenticated users to the landing page
    },
  }
);

export const config = {
  matcher: [
    '/home', // Protect the home page
    '/accounts/:path*', // Protect accounts pages
    '/uploads/:path*', // Protect uploads pages
    '/tiktok-downloader/:path*', // Protect tiktok downloader page
    '/admin/:path*', // Protect admin pages
    // Add other protected routes here
  ],
};