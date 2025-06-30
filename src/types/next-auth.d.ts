import { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: {
      auth_user_id?: string; // Add auth_user_id to user object
    } & DefaultSession["user"];
    active_account_id?: string | null; // Add active_account_id to session
    account?: any; // To allow for the account object in session
  }

  interface JWT extends DefaultJWT {
    auth_user_id?: string; // Add auth_user_id to JWT
    active_account_id?: string | null; // Add active_account_id to JWT
    account?: any; // To allow for the account object in JWT
  }

  interface AdapterUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    auth_user_id?: string;
    active_account_id?: string | null;
    account?: any;
  }
} 