import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/lib/supabase-server';

// DELETE /api/accounts/[id] - Remove an account
export async function DELETE(request, { params }) {
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

    const { id } = await params;
    const authUserId = session.user.auth_user_id;
    
    // Check if account exists and belongs to user
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('accounts')
      .select('id, owner_id, account_type')
      .eq('id', id)
      .eq('owner_id', authUserId)
      .single();
    
    if (fetchError || !account) {
      console.error('Account not found:', fetchError);
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Check if this is the user's only account
    const { count, error: countError } = await supabaseAdmin
      .from('accounts')
      .select('id', { count: 'exact' })
      .eq('owner_id', authUserId);
    
    if (countError) {
      console.error('Error counting accounts:', countError);
      return NextResponse.json({ error: 'Failed to check account count' }, { status: 500 });
    }
    
    if (count === 1) {
      return NextResponse.json({ error: 'Cannot delete the only account. Add another account first.' }, { status: 400 });
    }
    
    // Delete related tokens first
    const { error: tokenDeleteError } = await supabaseAdmin
      .from('user_tokens')
      .delete()
      .eq('account_id', id);
    
    if (tokenDeleteError) {
      console.error('Error deleting account tokens:', tokenDeleteError);
      // Continue with account deletion even if token deletion fails
    }
    
    // Delete the account
    const { error: accountDeleteError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('owner_id', authUserId);
    
    if (accountDeleteError) {
      console.error('Error deleting account:', accountDeleteError);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete account route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
