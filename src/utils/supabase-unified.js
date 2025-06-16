/**
 * Unified Supabase client that exports all functions from both client and server files
 * This helps avoid import confusion and ensures consistent usage across the application
 */

// Re-export everything from server implementation
export * from '../lib/supabase-server';

// Re-export client implementation with a different name to avoid conflicts
export { supabase as supabaseClient } from './supabase'; 