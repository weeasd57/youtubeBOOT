import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase';

// API endpoint to schedule a video upload
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { 
      fileId,
      fileName, 
      title, 
      description, 
      scheduledTime  // ISO string format
    } = await request.json();
    
    // Validate required fields
    if (!fileId || !fileName || !title || !scheduledTime) {
      return NextResponse.json({ 
        error: 'Missing required fields: fileId, fileName, title, and scheduledTime are required' 
      }, { status: 400 });
    }
    
    // Validate scheduled time is in the future
    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return NextResponse.json({ 
        error: 'Scheduled time must be in the future' 
      }, { status: 400 });
    }
    
    // Insert scheduled upload into database
    const { data, error } = await supabaseAdmin
      .from('scheduled_uploads')
      .insert({
        user_email: session.user.email,
        file_id: fileId,
        file_name: fileName,
        title,
        description: description || '',
        scheduled_time: scheduledTime,
      })
      .select();
    
    if (error) {
      console.error('Error scheduling upload:', error);
      return NextResponse.json({ 
        error: 'Failed to schedule upload: ' + error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      message: 'Upload scheduled successfully',
      scheduledUpload: data[0]
    });
  } catch (error) {
    console.error('Error in schedule upload API:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error.message 
    }, { status: 500 });
  }
} 