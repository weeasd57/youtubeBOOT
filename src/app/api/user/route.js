import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase';

// Get current user's data from Supabase
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user data from Supabase
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Update user data in Supabase
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    
    // Fields that we allow to be updated
    const allowedFields = ['name', 'preferences', 'settings'];
    const updateData = {};
    
    // Only include allowed fields
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    // Update user data in Supabase
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('email', session.user.email)
      .select();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ user: data[0] });
  } catch (error) {
    console.error('Error updating user data:', error);
    return NextResponse.json(
      { error: 'Failed to update user data: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 