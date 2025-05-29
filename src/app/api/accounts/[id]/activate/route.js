import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// POST /api/accounts/[id]/activate - Set an account as the active one
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.authUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const authUserId = session.authUserId;
    
    // Verify account belongs to user
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('owner_id', authUserId)
      .single();
    
    if (fetchError || !account) {
      console.error('Account not found:', fetchError);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Update last used timestamp
    const { error: updateError } = await supabaseAdmin
      .from('accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating account last used:', updateError);
      // Non-critical error, continue
    }

    // Update user's active account
    const { error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ active_account_id: id })
      .eq('id', authUserId);
    
    if (userUpdateError) {
      console.error('Error updating user active account:', userUpdateError);
    }
    
    return NextResponse.json({
      success: true,
      accountId: id,
      message: 'Account activated successfully'
    });
  } catch (error) {
    console.error('Error in account activate route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
