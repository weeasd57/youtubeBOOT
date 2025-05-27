import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// DELETE /api/accounts/[id] - Remove an account
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = params;
    
    // Check if it's a primary account
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('user_tokens')
      .select('is_primary')
      .eq('id', id)
      .eq('user_email', session.user.email)
      .single();
    
    if (fetchError) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    if (account.is_primary) {
      return NextResponse.json({ error: 'Cannot delete primary account' }, { status: 400 });
    }
    
    // Delete the account
    const { error } = await supabaseAdmin
      .from('user_tokens')
      .delete()
      .eq('id', id)
      .eq('user_email', session.user.email);
    
    if (error) {
      console.error('Error deleting account:', error);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete account route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
