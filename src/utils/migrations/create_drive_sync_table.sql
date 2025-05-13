-- Create a table to track Google Drive changes
CREATE TABLE IF NOT EXISTS drive_sync (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL UNIQUE,
  page_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_drive_sync_user_email ON drive_sync(user_email);

-- Add RLS policies for security
ALTER TABLE drive_sync ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own tokens
CREATE POLICY drive_sync_select_policy ON drive_sync
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_email = auth.email());

-- Only admins and system can update tokens (API endpoints)
CREATE POLICY drive_sync_insert_update_policy ON drive_sync
  FOR ALL
  USING (auth.uid() IS NOT NULL AND (
    auth.email() = user_email OR
    auth.jwt() ->> 'role' = 'admin'
  )); 