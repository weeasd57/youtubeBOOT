import { NextResponse } from 'next/server';

export function middleware(request) {
  // Log the request path and query
  if (request.nextUrl.pathname.startsWith('/api/auth/callback')) {
    console.log('\n\n=== AUTH CALLBACK ===');
    console.log('Path:', request.nextUrl.pathname);
    console.log('Query:', Object.fromEntries(request.nextUrl.searchParams.entries()));
    console.log('=====================\n\n');
  }

  return NextResponse.next();
}

// Only run middleware on auth paths
export const config = {
  matcher: [
    '/api/auth/:path*'
  ],
} 