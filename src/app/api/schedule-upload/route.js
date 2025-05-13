import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/options';
import { supabaseAdmin } from '@/utils/supabase';

// Get scheduled uploads for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get scheduled uploads from database
    const { data, error } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('*')
      .eq('user_email', session.user.email)
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ scheduledUploads: data });
  } catch (error) {
    console.error('Error fetching scheduled uploads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled uploads: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Cancel a scheduled upload
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Missing scheduled upload ID' }, { status: 400 });
    }
    
    // Verify the scheduled upload belongs to the user
    const { data: upload, error: fetchError } = await supabaseAdmin
      .from('scheduled_uploads')
      .select('*')
      .eq('id', id)
      .eq('user_email', session.user.email)
      .single();
      
    if (fetchError || !upload) {
      return NextResponse.json({ 
        error: 'Scheduled upload not found or access denied' 
      }, { status: 404 });
    }
    
    // Delete the scheduled upload
    const { error: deleteError } = await supabaseAdmin
      .from('scheduled_uploads')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      return NextResponse.json({ 
        error: 'Failed to cancel scheduled upload: ' + deleteError.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'Scheduled upload cancelled successfully' 
    });
  } catch (error) {
    console.error('Error cancelling scheduled upload:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled upload: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}

// Create a new scheduled upload
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Parse the request body
    const uploadData = await request.json();
    
    // Validate required fields
    if (!uploadData.fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }
    
    // تنظيف وتحقق من العنوان
    let videoTitle = uploadData.title;
    if (!videoTitle || videoTitle.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    
    // تنظيف العنوان من الأحرف غير الصالحة
    videoTitle = videoTitle.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    
    // التأكد مرة أخرى أن العنوان ليس فارغا بعد التنظيف
    if (videoTitle === '') {
      return NextResponse.json({ 
        error: 'Title contains only invalid characters. Please provide a valid title.' 
      }, { status: 400 });
    }
    
    // تقييد طول العنوان إلى 100 حرف (حد YouTube)
    if (videoTitle.length > 100) {
      videoTitle = videoTitle.substring(0, 100);
    }
    
    // تنظيف الوصف
    let videoDescription = uploadData.description || '';
    videoDescription = videoDescription.trim();
    
    // تقييد طول الوصف
    if (videoDescription.length > 5000) {
      videoDescription = videoDescription.substring(0, 5000);
    }
    
    if (!uploadData.scheduledTime) {
      return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 });
    }
    
    // التحقق من أن وقت الجدولة مستقبلي
    const scheduledDate = new Date(uploadData.scheduledTime);
    const now = new Date();
    
    if (scheduledDate <= now) {
      return NextResponse.json({ 
        error: 'Scheduled time must be in the future' 
      }, { status: 400 });
    }
    
    // التحقق من أن الملف موجود في Google Drive
    // هذا يمكن أن يكون خطوة إضافية للتحقق من صحة الملف قبل الجدولة
    
    // Create the scheduled upload in the database
    const { data: scheduledUpload, error } = await supabaseAdmin
      .from('scheduled_uploads')
      .insert({
        file_id: uploadData.fileId,
        file_name: uploadData.fileName || '',
        title: videoTitle,
        description: videoDescription,
        user_email: session.user.email,
        scheduled_time: uploadData.scheduledTime,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating scheduled upload:', error);
      return NextResponse.json(
        { error: 'Failed to schedule upload: ' + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      message: 'Upload scheduled successfully',
      scheduledUpload
    });
  } catch (error) {
    console.error('Error scheduling upload:', error);
    return NextResponse.json(
      { error: 'Failed to schedule upload: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 