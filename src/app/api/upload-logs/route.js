import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase-server';

// Get upload logs for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user upload logs from Supabase
    const { data, error } = await supabaseAdmin
      .from('upload_logs')
      .select('*')
      .eq('user_email', session.user.email)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ logs: data });
  } catch (error) {
    console.error('Error fetching upload logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload logs: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Create a new upload log
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { 
      video_id, 
      file_id, 
      file_name, 
      youtube_url, 
      title,
      status,
      error_message 
    } = await request.json();
    
    // Insert upload log into Supabase
    const { data, error } = await supabaseAdmin
      .from('upload_logs')
      .insert({
        user_email: session.user.email,
        video_id,
        file_id,
        file_name,
        youtube_url,
        title,
        status,
        error_message,
        created_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ log: data[0] });
  } catch (error) {
    console.error('Error creating upload log:', error);
    return NextResponse.json(
      { error: 'Failed to create upload log: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 