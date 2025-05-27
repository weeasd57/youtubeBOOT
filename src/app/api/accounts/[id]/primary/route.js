import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// PATCH /api/accounts/[id]/primary - Set an account as the primary one
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = params;
    
    // Verify account belongs to user
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('user_tokens')
      .select('id')
      .eq('id', id)
      .eq('user_email', session.user.email)
      .single();
    
    if (fetchError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Start a transaction to update primary status
    const { error } = await supabaseAdmin.rpc('set_primary_account', {
      p_account_id: id,
      p_user_email: session.user.email
    });
    
    if (error) {
      console.error('Error setting primary account:', error);
      return NextResponse.json({ error: 'Failed to set primary account' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in primary account route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
