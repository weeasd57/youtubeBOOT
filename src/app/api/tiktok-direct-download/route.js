import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log(`TikTok download requested for: ${url}`);
    
    // Extraer el ID del video de la URL
    let videoId = '';
    try {
      const match = url.match(/\/video\/(\d+)/);
      if (match && match[1]) {
        videoId = match[1];
        console.log(`Extracted TikTok video ID: ${videoId}`);
      }
    } catch (err) {
      console.warn('Error extracting video ID:', err.message);
    }
    
    try {
      // Usar SaveTik.net en lugar de SnapTik.app
      console.log('Using SaveTik.net for download...');
      
      // Paso 1: Preparar la solicitud a SaveTik.net
      const saveTikURL = 'https://savetik.net/api/ajaxSearch';
      const formData = new URLSearchParams();
      formData.append('q', url);
      formData.append('lang', 'en');
      
      // Paso 2: Enviar solicitud a SaveTik
      const saveTikResponse = await axios.post(saveTikURL, formData.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://savetik.net',
          'Referer': 'https://savetik.net/',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      });
      
      console.log('Received response from SaveTik');
      
      // Verificar si la respuesta contiene datos
      if (!saveTikResponse.data || !saveTikResponse.data.data) {
        console.error('Invalid response from SaveTik:', saveTikResponse.data);
        return NextResponse.json({ error: 'Invalid response from service' }, { status: 500 });
      }
      
      // Analizar la respuesta HTML para extraer enlaces de descarga
      const $ = cheerio.load(saveTikResponse.data.data);
      let downloadUrl = '';
      
      // Buscar enlaces de descarga (sin marca de agua preferentemente)
      const downloadLinks = $('a[href*=".mp4"]');
      downloadLinks.each((index, element) => {
        const link = $(element).attr('href');
        const text = $(element).text().toLowerCase();
        
        // Priorizar enlaces "sin marca de agua" o "hd"
        if (text.includes('without watermark') || text.includes('no watermark') || text.includes('hd')) {
          downloadUrl = link;
          return false; // detener el bucle
        }
        
        // Como respaldo, guardar el primer enlace encontrado
        if (!downloadUrl) {
          downloadUrl = link;
        }
      });
      
      // Si no encontramos enlaces específicos, buscar cualquier enlace que parezca un video
      if (!downloadUrl) {
        $('a').each((index, element) => {
          const link = $(element).attr('href');
          if (link && (link.includes('.mp4') || link.includes('video') || link.includes('download'))) {
            downloadUrl = link;
            return false;
          }
        });
      }
      
      if (!downloadUrl) {
        console.error('No download URL found in SaveTik response');
        return NextResponse.json({ error: 'No download URL found' }, { status: 404 });
      }
      
      console.log(`Download URL found: ${downloadUrl.substring(0, 50)}...`);
      
      // Paso 3: Descargar el video real
      console.log('Downloading video from server...');
      const videoResponse = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://savetik.net/'
        }
      });
      
      console.log('Video downloaded, size:', videoResponse.data.byteLength);
      
      // Verificar el tipo de contenido
      const contentType = videoResponse.headers['content-type'];
      if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
        console.warn(`Warning: Content-Type not a video: ${contentType}`);
      }
      
      // Verificar que realmente recibimos datos binarios, no HTML
      if (videoResponse.data.byteLength < 1000) {
        console.error('Downloaded content too small to be a video');
        return NextResponse.json({ error: 'Downloaded content is too small to be a video' }, { status: 500 });
      }
      
      const firstBytes = Buffer.from(videoResponse.data).slice(0, 4).toString('hex');
      if (firstBytes.includes('3c21') || firstBytes.includes('3c68')) {
        console.error('Downloaded content appears to be HTML, not a video');
        return NextResponse.json({ error: 'Downloaded content is not a video' }, { status: 500 });
      }
      
      // Para el nombre del archivo, usar el ID del video o timestamp
      const fileName = videoId ? `tiktok-${videoId}.mp4` : `tiktok-${Date.now()}.mp4`;
      
      // Devolver el video como respuesta
      return new NextResponse(videoResponse.data, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    } catch (error) {
      console.error('Error processing TikTok download:', error);
      
      // Intentar con método alternativo si el primero falla
      try {
        console.log('First method failed. Trying alternate method with SSSTikTok...');
        
        // Método alternativo usando SSSTikTok
        const sssTikURL = 'https://ssstiktok.io/api/1/fetch';
        const alternateFormData = new URLSearchParams();
        alternateFormData.append('url', url);
        alternateFormData.append('locale', 'en');
        
        const alternateResponse = await axios.post(sssTikURL, alternateFormData.toString(), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://ssstiktok.io',
            'Referer': 'https://ssstiktok.io/'
          },
          timeout: 15000
        });
        
        if (alternateResponse.data && alternateResponse.data.url) {
          console.log('Alternate method successful. Downloading video...');
          const alternateVideoURL = alternateResponse.data.url;
          
          const alternateVideoResponse = await axios({
            method: 'GET',
            url: alternateVideoURL,
            responseType: 'arraybuffer',
            timeout: 30000
          });
          
          console.log('Video downloaded via alternate method, size:', alternateVideoResponse.data.byteLength);
          
          // Para el nombre del archivo, usar el ID del video o timestamp
          const fileName = videoId ? `tiktok-${videoId}.mp4` : `tiktok-${Date.now()}.mp4`;
          
          // Devolver el video como respuesta
          return new NextResponse(alternateVideoResponse.data, {
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Disposition': `attachment; filename="${fileName}"`,
            },
          });
        } else {
          throw new Error('Alternate method failed: Invalid response');
        }
      } catch (alternateError) {
        console.error('Alternate method also failed:', alternateError);
        
        // Intentar con un tercer método: tikwm.com
        try {
          console.log('Second method failed. Trying third method with tikwm.com...');
          
          // Método usando tikwm.com
          const tikwmURL = 'https://www.tikwm.com/api/';
          const tikwmParams = new URLSearchParams();
          tikwmParams.append('url', url);
          tikwmParams.append('hd', '1');
          
          const tikwmResponse = await axios.post(tikwmURL, tikwmParams.toString(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
              'Origin': 'https://www.tikwm.com',
              'Referer': 'https://www.tikwm.com/'
            },
            timeout: 15000
          });
          
          if (tikwmResponse.data && tikwmResponse.data.data && tikwmResponse.data.data.play) {
            console.log('Third method successful. Downloading video...');
            const tikwmVideoURL = tikwmResponse.data.data.play;
            
            const tikwmVideoResponse = await axios({
              method: 'GET',
              url: tikwmVideoURL,
              responseType: 'arraybuffer',
              timeout: 30000
            });
            
            console.log('Video downloaded via third method, size:', tikwmVideoResponse.data.byteLength);
            
            // Para el nombre del archivo, usar el ID del video o timestamp
            const fileName = videoId ? `tiktok-${videoId}.mp4` : `tiktok-${Date.now()}.mp4`;
            
            // Devolver el video como respuesta
            return new NextResponse(tikwmVideoResponse.data, {
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `attachment; filename="${fileName}"`,
              },
            });
          } else {
            throw new Error('Third method failed: Invalid response');
          }
        } catch (thirdMethodError) {
          console.error('Third method also failed:', thirdMethodError);
          
          // En caso de error en todos los métodos, devolver error detallado
          return NextResponse.json({ 
            error: 'Failed to download video with all methods', 
            details: error.message,
            alternateError: alternateError.message,
            thirdMethodError: thirdMethodError.message,
            url: url 
          }, { status: 500 });
        }
      }
    }
  } catch (error) {
    console.error('Error in TikTok download endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
} 