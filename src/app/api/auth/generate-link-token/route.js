import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';
import crypto from 'crypto';

export async function POST(req) {
  try {    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Use auth_user_id from the session
    const userId = session.user.auth_user_id;
    
    if (!userId) {
      return NextResponse.json({ message: "Missing user ID" }, { status: 400 });
    }

    // First, ensure the user exists in the users table
    const { data: existingUser, error: userCheckError } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userCheckError || !existingUser) {
      // User doesn't exist, create them
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: session.user.email,
          name: session.user.name,
          avatar_url: session.user.picture,
          google_id: session.user.sub
        });

      if (insertError) {
        console.error('Error creating user:', insertError);
        return NextResponse.json({ 
          message: "Failed to create user",
          error: insertError
        }, { status: 500 });
      }
    }

    // Generate a secure, single-use token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Token valid for 5 minutes

    const { data, error } = await supabaseAdmin
      .from('account_link_tokens')
      .insert([{ token, user_id: userId, expires_at: expiresAt }])
      .select();

    if (error) {
      console.error('Error inserting linking token:', error);
      return NextResponse.json({ 
        message: "Failed to generate link token",
        error: error
      }, { status: 500 });
    }

    return NextResponse.json({ token }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error generating link token:', error);
    return NextResponse.json({ 
      message: "Internal server error",
      error: error.message
    }, { status: 500 });
  }
}