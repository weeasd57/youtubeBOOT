-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow insert for service role
CREATE POLICY "Enable insert for service role" ON public.users
FOR INSERT TO service_role
WITH CHECK (true);

-- Allow select for authenticated users
CREATE POLICY "Enable select for authenticated users" ON public.users
FOR SELECT USING (true);

-- Allow update for service role
CREATE POLICY "Enable update for service role" ON public.users
FOR UPDATE TO service_role
USING (true);

-- Allow delete for service role
CREATE POLICY "Enable delete for service role" ON public.users
FOR DELETE TO service_role
USING (true);
