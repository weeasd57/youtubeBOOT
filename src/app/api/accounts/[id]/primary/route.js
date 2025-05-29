import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// PATCH /api/accounts/[id]/primary - Set an account as the primary one
export async function PATCH(request, { params }) {
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
      .select('id, owner_id')
      .eq('id', id)
      .eq('owner_id', authUserId)
      .single();
    
    if (fetchError || !account) {
      console.error('Account not found:', fetchError);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // First, set all accounts for this user to non-primary
    const { error: resetError } = await supabaseAdmin
      .from('accounts')
      .update({ is_primary: false })
      .eq('owner_id', authUserId);
    
    if (resetError) {
      console.error('Error resetting primary accounts:', resetError);
      return NextResponse.json({ error: 'Failed to reset primary accounts' }, { status: 500 });
    }
    
    // Then set the specified account as primary
    const { error: setPrimaryError } = await supabaseAdmin
      .from('accounts')
      .update({ is_primary: true })
      .eq('id', id);
    
    if (setPrimaryError) {
      console.error('Error setting primary account:', setPrimaryError);
      return NextResponse.json({ error: 'Failed to set primary account' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in primary account route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
