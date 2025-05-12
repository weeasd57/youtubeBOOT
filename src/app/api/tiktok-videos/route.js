import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase';

// GET handler for retrieving user's TikTok videos
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    const email = session.user.email;
    if (!email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }
    
    // Check if the tiktok_videos table exists before querying
    try {
      // Get TikTok videos from Supabase
      const { data, error } = await supabaseAdmin
        .from('tiktok_videos')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching TikTok videos:', error);
        
        // If table doesn't exist, return empty array instead of error
        if (error.code === '42P01') { // undefined_table error
          return NextResponse.json({ videos: [] });
        }
        
        throw error;
      }
      
      return NextResponse.json({ videos: data || [] });
    } catch (dbError) {
      console.error('Database error fetching TikTok videos:', dbError);
      return NextResponse.json({ videos: [] });
    }
  } catch (error) {
    console.error('Error in TikTok videos API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TikTok videos: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 