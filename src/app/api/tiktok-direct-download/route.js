import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log(`TikTok download requested for: ${url}`);
    
    // No download services are used anymore - direct links from JSON only
    return NextResponse.json({ 
      error: 'Direct download services are disabled', 
      message: 'Application now uses only direct links (downloadAddr or mediaUrls) from JSON files'
    }, { status: 501 });
    
  } catch (error) {
    console.error('Unhandled error in TikTok download:', error);
    return NextResponse.json({ 
      error: 'Failed to download TikTok video', 
      message: error.message 
    }, { status: 500 });
  }
} 