import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request) {
  try {
    console.log('TikTok download API endpoint called');
    
    const { url } = await request.json();
    
    if (!url) {
      console.log('URL is required');
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log(`Processing TikTok URL: ${url}`);

    // Enfoque simplificado: intentar directamente con la URL de TikTok
    // Este es un enfoque alternativo que puede funcionar si el método principal falla
    return NextResponse.json({ 
      downloadUrl: `/api/tiktok-direct-download?url=${encodeURIComponent(url)}`,
      message: 'Using direct download method'
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