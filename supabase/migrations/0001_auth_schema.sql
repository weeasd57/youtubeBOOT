-- Drop any existing tables to avoid conflicts
DROP TABLE IF EXISTS public.user_tokens CASCADE;
DROP TABLE IF EXISTS public.user_accounts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    active_account_id uuid,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create user_accounts table
CREATE TABLE public.user_accounts (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid,
    name TEXT,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT user_accounts_pkey PRIMARY KEY (id),
    CONSTRAINT user_accounts_user_id_email_key UNIQUE (user_id, email)
);

-- Enable RLS on user_accounts table
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

-- Create user_tokens table
CREATE TABLE public.user_tokens (
    id uuid DEFAULT gen_random_uuid(),
    auth_user_id uuid,
    account_id uuid,
    user_email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at BIGINT,
    is_valid BOOLEAN DEFAULT true,
    error_message TEXT,
    last_network_error TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT user_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT user_tokens_user_email_key UNIQUE (user_email)
);

-- Enable RLS on user_tokens table
ALTER TABLE public.user_tokens ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraints
ALTER TABLE public.user_accounts
    ADD CONSTRAINT user_accounts_user_id_fkey
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id)
    ON DELETE CASCADE;

ALTER TABLE public.users
    ADD CONSTRAINT users_active_account_id_fkey
    FOREIGN KEY (active_account_id) 
    REFERENCES public.user_accounts(id)
    ON DELETE SET NULL;

ALTER TABLE public.user_tokens
    ADD CONSTRAINT user_tokens_auth_user_id_fkey
    FOREIGN KEY (auth_user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;

ALTER TABLE public.user_tokens
    ADD CONSTRAINT user_tokens_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES public.user_accounts(id)
    ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON public.user_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_email ON public.user_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_user_tokens_auth_user_id ON public.user_tokens(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_account_id ON public.user_tokens(account_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'set_users_updated_at'
    ) THEN
        CREATE TRIGGER set_users_updated_at
            BEFORE UPDATE ON public.users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'set_user_accounts_updated_at'
    ) THEN
        CREATE TRIGGER set_user_accounts_updated_at
            BEFORE UPDATE ON public.user_accounts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'set_user_tokens_updated_at'
    ) THEN
        CREATE TRIGGER set_user_tokens_updated_at
            BEFORE UPDATE ON public.user_tokens
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
