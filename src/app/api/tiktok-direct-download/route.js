import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log(`Direct download requested for: ${url}`);
    
    // Primero intentar obtener la URL de TikTok para extraer el ID del video
    let videoId = '';
    try {
      // Extraer el ID del video de la URL
      const match = url.match(/\/video\/(\d+)/);
      if (match && match[1]) {
        videoId = match[1];
        console.log(`Extracted TikTok video ID: ${videoId}`);
      }
    } catch (err) {
      console.warn('Error extracting video ID:', err.message);
    }
    
    // URL a descargar (usamos la original si no podemos procesarla)
    const downloadUrl = url;
    
    try {
      // Descargar el video directamente
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 segundos de timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
        }
      });
      
      console.log('Video downloaded, size:', response.data.byteLength);
      
      // Verificar que el contenido descargado sea un video
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('video')) {
        console.warn(`Content-Type not a video: ${contentType}`);
      }
      
      // Para el nombre del archivo, usar el ID del video o timestamp si no está disponible
      const fileName = videoId ? `tiktok-${videoId}.mp4` : `tiktok-${Date.now()}.mp4`;
      
      // Devolver el video como respuesta
      return new NextResponse(response.data, {
        headers: {
          'Content-Type': contentType || 'video/mp4',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } catch (downloadError) {
      console.error('Error downloading video:', downloadError);
      
      // Si falla la descarga directa, redirigimos al usuario a la URL original como último recurso
      return NextResponse.redirect(url);
    }
  } catch (error) {
    console.error('Error in direct download:', error);
    return NextResponse.json(
      { error: 'Failed to download video', details: error.message },
      { status: 500 }
    );
  }
} 