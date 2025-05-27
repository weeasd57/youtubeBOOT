import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// POST /api/accounts/[id]/activate - Set an account as the active one
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = params;
    
    // Verify account belongs to user
    const { data: account, error: fetchError } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('id', id)
      .eq('user_email', session.user.email)
      .single();
    
    if (fetchError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
    
    // Update last used timestamp
    const { error: updateError } = await supabaseAdmin
      .from('user_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);
    
    if (updateError) {
      console.error('Error updating account last used:', updateError);
      // Non-critical error, continue
    }
    
    return NextResponse.json({
      success: true,
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: account.expires_at
    });
  } catch (error) {
    console.error('Error in account activate route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
