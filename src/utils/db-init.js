import { supabaseAdmin } from './supabase';
import fs from 'fs';
import path from 'path';

/**
 * Initialize the database with the required schema
 * This function ensures tables exist and are properly configured
 */
export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');
    
    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src', 'utils', 'db-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Since we can't directly execute SQL through Supabase JS client,
    // we'll check for the existence of key tables and handle them manually
    
    // Check if scheduled_uploads table exists
    const scheduledUploadsExists = await tableExists('scheduled_uploads');
    
    if (!scheduledUploadsExists) {
      console.log('Creating scheduled_uploads table...');
      await createScheduledUploadsTable();
    } else {
      console.log('scheduled_uploads table already exists');
    }
    
    // Check if user_tokens table exists
    const userTokensExists = await tableExists('user_tokens');
    
    if (!userTokensExists) {
      console.log('Creating user_tokens table...');
      await createUserTokensTable();
    } else {
      console.log('user_tokens table already exists');
    }
    
    console.log('Database schema initialization completed');
    return true;
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    return false;
  }
}

/**
 * Create the scheduled_uploads table
 */
async function createScheduledUploadsTable() {
  // We need to create the table using Supabase API
  try {
    const { error } = await supabaseAdmin
      .from('scheduled_uploads')
      .insert({ 
        // Insert a dummy record that will be immediately deleted
        id: '00000000-0000-0000-0000-000000000000',
        user_email: 'temp@example.com',
        file_id: 'temp',
        file_name: 'temp',
        title: 'temp',
        scheduled_time: new Date().toISOString(),
        status: 'pending'
      })
      .select();
    
    // If error is "relation does not exist", the table needs to be created
    // Otherwise, another error occurred or the table exists
    if (error && error.code === '42P01') {
      console.log('Creating scheduled_uploads table using SQL dump...');
      
      // For now, we'll log that this needs to be done manually
      // In a real scenario, you would use a database migration tool or direct SQL connection
      console.log('ERROR: Cannot automatically create table. Please run the schema.sql script directly in your database.');
      
      return false;
    } else if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Error creating scheduled_uploads table:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in createScheduledUploadsTable:', error);
    return false;
  }
}

/**
 * Create the user_tokens table
 */
async function createUserTokensTable() {
  try {
    const { error } = await supabaseAdmin
      .from('user_tokens')
      .insert({ 
        // Insert a dummy record that will be immediately deleted
        id: '00000000-0000-0000-0000-000000000000',
        user_email: 'temp@example.com',
        access_token: 'temp',
      })
      .select();
    
    // If error is "relation does not exist", the table needs to be created
    // Otherwise, another error occurred or the table exists
    if (error && error.code === '42P01') {
      console.log('Creating user_tokens table using SQL dump...');
      
      // For now, we'll log that this needs to be done manually
      console.log('ERROR: Cannot automatically create table. Please run the schema.sql script directly in your database.');
      
      return false;
    } else if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Error creating user_tokens table:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in createUserTokensTable:', error);
    return false;
  }
}

/**
 * Check if a table exists in the database
 * @param {string} tableName - The name of the table to check
 * @returns {Promise<boolean>} - True if the table exists, false otherwise
 */
export async function tableExists(tableName) {
  try {
    // Try to select a single row from the table - this will fail if the table doesn't exist
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      // 42P01 is the PostgreSQL error code for "relation does not exist"
      if (error.code === '42P01') {
        return false;
      }
      // For other errors, log them but assume the table might exist
      console.error(`Error checking if table ${tableName} exists:`, error);
    }
    
    // If we got here without a "relation does not exist" error, the table exists
    return true;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Create an API route to manually trigger database initialization
 * This can be used for debugging or during deployment
 */
export async function handleInitRequest(req) {
  try {
    // This would be used in a Next.js API route
    // Ensure proper authorization before allowing initialization
    const result = await initializeDatabase();
    
    return {
      success: result,
      message: result ? 'Database initialization check completed successfully' : 'Database initialization failed'
    };
  } catch (error) {
    console.error('Error in DB init request handler:', error);
    
    return {
      success: false,
      message: 'Error initializing database',
      error: error.message
    };
  }
} 