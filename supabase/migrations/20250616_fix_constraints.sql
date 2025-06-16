-- Drop existing foreign key constraint
ALTER TABLE public.account_link_tokens 
DROP CONSTRAINT IF EXISTS account_link_tokens_user_id_fkey;

-- Make user_id NOT NULL
ALTER TABLE public.account_link_tokens 
ALTER COLUMN user_id SET NOT NULL;

-- Recreate foreign key constraint
ALTER TABLE public.account_link_tokens
ADD CONSTRAINT account_link_tokens_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id)
ON DELETE CASCADE;
