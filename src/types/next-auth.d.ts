import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

/**
 * We augment the built-in NextAuth types so TypeScript knows about
 * custom fields we attach in the callbacks (auth_user_id, active_account_id …).
 */

declare module 'next-auth' {
  interface User extends DefaultUser {
    /** UUID stored in public.users.id which maps to auth.users.user_id */
    auth_user_id?: string;
  }

  interface Session extends DefaultSession {
    user?: User;
    /** The currently selected account id (from public.accounts) */
    active_account_id?: string | null;
    /** Raw provider account object (optional) */
    account?: unknown;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    auth_user_id?: string;
    active_account_id?: string | null;
    account?: unknown;
  }
}

export {}; // Makes this a module 