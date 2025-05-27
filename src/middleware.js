import { withAuth } from 'next-auth/middleware';

export default withAuth(
  // `withAuth` augments your Next.js Request with the user's token.
  function middleware(req) {
    // console.log("middleware: ", req.nextUrl.pathname)
    // console.log("middleware: ", req.nextauth.token)
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