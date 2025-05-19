import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('TikTok download API endpoint called');
    
    const { url } = await request.json();
    
    if (!url) {
      console.log('URL is required');
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log(`Processing TikTok URL: ${url}`);

    // Return the original URL directly
    return NextResponse.json({ 
      downloadUrl: url,
      message: 'Using direct URL only'
    });
    
  } catch (error) {
    console.error('Error processing TikTok download:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process TikTok download', 
        details: error.message
      },
      { status: 500 }
    );
  }
}