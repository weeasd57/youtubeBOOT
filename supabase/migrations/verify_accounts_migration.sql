-- Verification Script for Accounts Table Migration
-- Run this script after applying the migration to verify everything is working correctly

-- 1. Check if all required columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'accounts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if all indexes were created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'accounts' 
  AND schemaname = 'public'
ORDER BY indexname;

-- 3. Check if constraints were added
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'accounts'::regclass
ORDER BY conname;

-- 4. Check if triggers were created
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'accounts'
ORDER BY trigger_name;

-- 5. Check if functions were created
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
  'update_accounts_updated_at',
  'ensure_single_primary_account',
  'update_account_last_used'
)
ORDER BY routine_name;

-- 6. Check if view was created
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'account_stats'
  AND table_schema = 'public';

-- 7. Verify data integrity - check primary accounts
SELECT 
  owner_id,
  COUNT(*) as total_accounts,
  COUNT(CASE WHEN is_primary THEN 1 END) as primary_accounts
FROM accounts 
GROUP BY owner_id
HAVING COUNT(CASE WHEN is_primary THEN 1 END) != 1;

-- 8. Check sample data to ensure migration worked
SELECT 
  id,
  owner_id,
  parent_account_id,
  account_type,
  name,
  is_primary,
  is_active,
  email,
  created_at,
  updated_at
FROM accounts 
ORDER BY created_at DESC 
LIMIT 5;

-- 9. Test the account_stats view (commented out - view does not exist)
-- SELECT * FROM account_stats LIMIT 5;