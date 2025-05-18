-- Create tiktok_videos table
CREATE TABLE IF NOT EXISTS public.tiktok_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  video_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  original_url TEXT,
  download_url TEXT,
  drive_folder_id TEXT,
  drive_file_id TEXT,
  thumbnail_url TEXT,
  duration REAL,
  video_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the constraint already exists, drop it first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_user' 
    AND table_name = 'tiktok_videos'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP CONSTRAINT fk_user;
  END IF;
END
$$;

-- Add foreign key reference if the users table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.tiktok_videos
    ADD CONSTRAINT fk_user FOREIGN KEY (user_email) REFERENCES public.users(email) ON DELETE CASCADE;
  END IF;
END
$$;

-- Add RLS policies
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;

-- Check if policies exist and drop them if they do
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tiktok_videos' 
    AND policyname = 'Users can view their own videos'
  ) THEN
    DROP POLICY "Users can view their own videos" ON public.tiktok_videos;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tiktok_videos' 
    AND policyname = 'Users can insert their own videos'
  ) THEN
    DROP POLICY "Users can insert their own videos" ON public.tiktok_videos;
  END IF;
END
$$;

-- Policy to allow users to view only their own videos
CREATE POLICY "Users can view their own videos" 
ON public.tiktok_videos 
FOR SELECT 
USING (
  user_email = auth.jwt() ->> 'email'
);

-- Policy to allow users to insert their own videos
CREATE POLICY "Users can insert their own videos" 
ON public.tiktok_videos 
FOR INSERT 
WITH CHECK (
  user_email = auth.jwt() ->> 'email'
);

-- Drop existing indexes if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tiktok_videos' 
    AND indexname = 'idx_tiktok_videos_user_email'
  ) THEN
    DROP INDEX IF EXISTS idx_tiktok_videos_user_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'tiktok_videos' 
    AND indexname = 'idx_tiktok_videos_video_id'
  ) THEN
    DROP INDEX IF EXISTS idx_tiktok_videos_video_id;
  END IF;
END
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_user_email ON public.tiktok_videos (user_email);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_video_id ON public.tiktok_videos (video_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_drive_file_id ON public.tiktok_videos (drive_file_id);

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT ON public.tiktok_videos TO anon, authenticated; 

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add thumbnail_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE public.tiktok_videos ADD COLUMN thumbnail_url TEXT;
  END IF;

  -- Add duration column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'duration'
  ) THEN
    ALTER TABLE public.tiktok_videos ADD COLUMN duration REAL;
  END IF;

  -- Add video_details column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'video_details'
  ) THEN
    ALTER TABLE public.tiktok_videos ADD COLUMN video_details JSONB DEFAULT '{}'::jsonb;
  END IF;
END
$$;

-- Drop unnecessary columns if they exist
DO $$
BEGIN
  -- Drop cover column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'cover'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN cover;
  END IF;

  -- Drop originCover column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'originCover'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN originCover;
  END IF;

  -- Drop dynamicCover column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'dynamicCover'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN dynamicCover;
  END IF;

  -- Drop play_count column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'play_count'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN play_count;
  END IF;

  -- Drop digg_count column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'digg_count'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN digg_count;
  END IF;

  -- Drop share_count column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'share_count'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN share_count;
  END IF;

  -- Drop comment_count column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tiktok_videos' 
    AND column_name = 'comment_count'
  ) THEN
    ALTER TABLE public.tiktok_videos DROP COLUMN comment_count;
  END IF;
END
$$; 