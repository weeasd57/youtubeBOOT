import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase-server';

export async function GET(request) {
  try {
    // الحصول على البريد الإلكتروني من معلمات الاستعلام
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`API route: Fetching TikTok videos for email ${email}`);
    
    // استعلام Supabase للحصول على بيانات فيديوهات TikTok
    const { data, error } = await supabaseAdmin
      .from('tiktok_videos')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // لنتحقق من عدد البيانات والمعرفات
    const videoIds = data?.map(video => video.video_id) || [];
    const sampleData = data?.slice(0, 3) || [];
    
    console.log(`API route: Found ${data?.length || 0} TikTok videos`);
    console.log(`API route: Video IDs sample: ${videoIds.slice(0, 5).join(', ')}`);
    console.log(`API route: First few videos:`, sampleData);

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 