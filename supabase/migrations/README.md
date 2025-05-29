# Database Migrations

This directory contains SQL migration files for the YouTube Boot application.

## Migration Files

### 20250529_update_accounts_table.sql

This migration updates the `accounts` table to include all necessary columns that are used by the application but were missing from the original schema.

#### Changes Made:

1. **Added Missing Columns:**
   - `is_primary` (BOOLEAN) - Indicates if this is the primary account for the owner
   - `last_used_at` (TIMESTAMP) - When the account was last used/activated
   - `is_active` (BOOLEAN) - Whether the account is currently active
   - `email` (TEXT) - Email address associated with the account
   - `image` (TEXT) - Profile image URL for the account
   - `description` (TEXT) - Optional description for the account
   - `created_at` (TIMESTAMP) - When the account was created

2. **Added Indexes for Performance:**
   - `idx_accounts_owner_id` - For filtering by owner
   - `idx_accounts_parent_account_id` - For hierarchical queries
   - `idx_accounts_is_primary` - For finding primary accounts
   - `idx_accounts_is_active` - For filtering active accounts
   - `idx_accounts_last_used_at` - For sorting by usage
   - `idx_accounts_created_at` - For sorting by creation date

3. **Added Constraints:**
   - `chk_account_type` - Ensures account_type is one of: 'google', 'primary', 'sub'
   - `idx_accounts_unique_primary` - Ensures only one primary account per owner

4. **Added Triggers and Functions:**
   - `update_accounts_updated_at()` - Automatically updates `updated_at` on row changes
   - `ensure_single_primary_account()` - Ensures only one primary account per owner
   - `update_account_last_used()` - Updates `last_used_at` when needed

5. **Added Views:**
   - `account_stats` - Provides statistics about accounts per owner

6. **Data Migration:**
   - Sets `created_at` for existing records
   - Automatically sets the first account as primary if no primary exists

## How to Apply Migration

### Using Supabase CLI:

```bash
# Navigate to your project directory
cd /path/to/your/project

# Apply the migration
supabase db push

# Or apply specific migration
supabase db reset
```

### Using Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `20250529_update_accounts_table.sql`
4. Execute the SQL

### Manual Application:

If you prefer to apply the migration manually:

1. Connect to your PostgreSQL database
2. Execute the SQL commands in `20250529_update_accounts_table.sql`

## Verification

After applying the migration, verify that:

1. All new columns exist in the `accounts` table
2. Indexes are created successfully
3. Constraints are in place
4. Triggers are working
5. Existing data has been migrated correctly

```sql
-- Check table structure
\d accounts

-- Check indexes
\di accounts*

-- Check constraints
\d+ accounts

-- Verify data migration
SELECT 
  id, 
  owner_id, 
  is_primary, 
  is_active, 
  created_at, 
  updated_at 
FROM accounts 
LIMIT 5;

-- Check account stats view
SELECT * FROM account_stats;
```

## Rollback

If you need to rollback this migration:

```sql
-- Remove added columns (be careful - this will lose data!)
ALTER TABLE accounts 
DROP COLUMN IF EXISTS is_primary,
DROP COLUMN IF EXISTS last_used_at,
DROP COLUMN IF EXISTS is_active,
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS image,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS created_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_accounts_owner_id;
DROP INDEX IF EXISTS idx_accounts_parent_account_id;
DROP INDEX IF EXISTS idx_accounts_is_primary;
DROP INDEX IF EXISTS idx_accounts_is_active;
DROP INDEX IF EXISTS idx_accounts_last_used_at;
DROP INDEX IF EXISTS idx_accounts_created_at;
DROP INDEX IF EXISTS idx_accounts_unique_primary;

-- Drop constraints
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS chk_account_type;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS trigger_ensure_single_primary ON accounts;
DROP FUNCTION IF EXISTS update_accounts_updated_at();
DROP FUNCTION IF EXISTS ensure_single_primary_account();
DROP FUNCTION IF EXISTS update_account_last_used();

-- Drop view
DROP VIEW IF EXISTS account_stats;
```

## Notes

- This migration is designed to be safe and non-destructive
- Existing data will be preserved
- The migration includes proper error handling with `IF NOT EXISTS` clauses
- All changes are documented with comments
- Performance optimizations are included via indexes