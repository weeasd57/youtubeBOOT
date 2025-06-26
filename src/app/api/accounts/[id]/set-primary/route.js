import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST /api/accounts/[id]/set-primary - Set an account as primary
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.auth_user_id) {
      console.log('Session missing required fields:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasAuthUserId: !!session?.user?.auth_user_id,
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = params;
    const authUserId = session.user.auth_user_id;
    
    // Check if account exists and belongs to user
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, owner_id')
      .eq('id', id)
      .eq('owner_id', authUserId)
      .single();
    
    if (fetchError || !account) {
      console.error('Account not found:', fetchError);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Start a transaction to update the is_primary flag
    const { error: updateError } = await supabaseAdmin.rpc('set_primary_account', {
      p_account_id: id,
      p_user_id: authUserId
    });
    
    if (updateError) {
      console.error('Error setting primary account:', updateError);
      
      // Fallback method if RPC fails - perform two updates manually
      
      // First, clear primary flag from all user accounts
      const { error: clearError } = await supabaseAdmin
        .from('accounts')
        .update({ is_primary: false })
        .eq('owner_id', authUserId);
      
      if (clearError) {
        console.error('Error clearing primary flags:', clearError);
        return NextResponse.json({ error: 'Failed to update account status' }, { status: 500 });
      }
      
      // Then set the target account as primary
      const { error: setPrimaryError } = await supabaseAdmin
        .from('accounts')
        .update({ is_primary: true })
        .eq('id', id)
        .eq('owner_id', authUserId);
      
      if (setPrimaryError) {
        console.error('Error setting primary account:', setPrimaryError);
        return NextResponse.json({ error: 'Failed to set primary account' }, { status: 500 });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in set primary account route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 