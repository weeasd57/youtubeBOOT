export interface Account {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  owner_id: string;
  provider: string;
  provider_account_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
  created_at: string;
  updated_at: string;
} 