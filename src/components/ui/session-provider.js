'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children, ...props }) {
  return <NextAuthSessionProvider {...props}>{children}</NextAuthSessionProvider>;
} 