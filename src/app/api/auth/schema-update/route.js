import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  // Simple check that this isn't called anonymously
  // In production, you'd want a better auth mechanism
  if (!authHeader || !authHeader.includes('Bearer')) {
    return NextResponse.json({
      success: false,
      message: 'Unauthorized'
    }, { status: 401 });
  }
  
  try {
    // 1. Add the is_valid column if it doesn't exist
    const { error: columnError } = await supabaseAdmin.rpc(
      'add_column_if_not_exists',
      {
        table_name: 'user_tokens',
        column_name: 'is_valid',
        column_type: 'boolean',
        column_default: 'true'
      }
    );
    
    if (columnError) {
      // Fall back to raw SQL if the RPC isn't available
      await supabaseAdmin.query(`
        ALTER TABLE IF EXISTS user_tokens 
        ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true;
      `);
    }
    
    // 2. Add last_network_error column if it doesn't exist
    const { error: networkErrorColumnError } = await supabaseAdmin.rpc(
      'add_column_if_not_exists',
      {
        table_name: 'user_tokens',
        column_name: 'last_network_error',
        column_type: 'timestamp',
        column_default: 'NULL'
      }
    );
    
    if (networkErrorColumnError) {
      // Fall back to raw SQL if the RPC isn't available
      await supabaseAdmin.query(`
        ALTER TABLE IF EXISTS user_tokens 
        ADD COLUMN IF NOT EXISTS last_network_error TIMESTAMP;
      `);
    }
    
    // 3. Add error_message column if it doesn't exist
    const { error: errorMessageColumnError } = await supabaseAdmin.rpc(
      'add_column_if_not_exists',
      {
        table_name: 'user_tokens',
        column_name: 'error_message',
        column_type: 'text',
        column_default: 'NULL'
      }
    );
    
    if (errorMessageColumnError) {
      // Fall back to raw SQL if the RPC isn't available
      await supabaseAdmin.query(`
        ALTER TABLE IF EXISTS user_tokens 
        ADD COLUMN IF NOT EXISTS error_message TEXT;
      `);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Schema updated successfully'
    });
  } catch (error) {
    console.error('Error updating schema:', error);
    return NextResponse.json({
      success: false,
      message: 'Error updating schema',
      error: error.message
    }, { status: 500 });
  }
} 