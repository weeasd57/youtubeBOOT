// This script is for running the database migrations

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Create Supabase client with service role key (for migrations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables for Supabase connection');
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Path to migration SQL file
const migrationFilePath = path.join(__dirname, '../src/utils/migrations/create_drive_sync_table.sql');

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFilePath, 'utf8');
    
    console.log('Running migration...');
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runMigration(); 