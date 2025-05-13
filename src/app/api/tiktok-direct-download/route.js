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
          
          // Try a fourth method
          try {
            console.log('Third method failed. Trying fourth method with MusicalDown...');
            
            // Method using MusicalDown
            const musicalDownURL = 'https://musicaldown.com/api/post';
            const musicalParams = new URLSearchParams();
            musicalParams.append('link', url);
            
            const musicalResponse = await axios.post(musicalDownURL, musicalParams.toString(), {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'Origin': 'https://musicaldown.com',
                'Referer': 'https://musicaldown.com/'
              },
              timeout: 15000
            });
            
            if (musicalResponse.data && musicalResponse.data.links && musicalResponse.data.links.length > 0) {
              console.log('Fourth method successful. Downloading video...');
              const musicalVideoURL = musicalResponse.data.links[0].url; // Get first download link
              
              const musicalVideoResponse = await axios({
                method: 'GET',
                url: musicalVideoURL,
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Referer': 'https://musicaldown.com/'
                }
              });
              
              console.log('Video downloaded via fourth method, size:', musicalVideoResponse.data.byteLength);
              
              // Use video ID or timestamp for filename
              const fileName = videoId ? `tiktok-${videoId}.mp4` : `tiktok-${Date.now()}.mp4`;
              
              // Return the video as response
              return new NextResponse(musicalVideoResponse.data, {
                headers: {
                  'Content-Type': 'video/mp4',
                  'Content-Disposition': `attachment; filename="${fileName}"`,
                },
              });
            } else {
              throw new Error('Fourth method failed: Invalid response');
            }
          } catch (fourthMethodError) {
            console.error('Fourth method also failed:', fourthMethodError);
            
            // Try a fifth method - directly accessing TikTok with a different approach
            try {
              console.log('Fourth method failed. Trying fifth method using TikTok API...');
              
              // First get the HTML content of the TikTok page
              const tiktokResponse = await axios.get(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml',
                  'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 15000
              });
              
              // Extract video data from the HTML
              const html = tiktokResponse.data;
              
              // Look for video URL in the HTML content
              let directVideoUrl = null;
              
              // Method 1: Try to find it in the JSON data embedded in the page
              const jsonMatch = html.match(/<script id="SIGI_STATE" type="application\/json">(.*?)<\/script>/s);
              if (jsonMatch && jsonMatch[1]) {
                try {
                  const jsonData = JSON.parse(jsonMatch[1]);
                  
                  // Navigate through the JSON structure to find video URL
                  if (jsonData.ItemModule && Object.keys(jsonData.ItemModule).length > 0) {
                    const firstKey = Object.keys(jsonData.ItemModule)[0];
                    const videoItem = jsonData.ItemModule[firstKey];
                    
                    if (videoItem && videoItem.video && videoItem.video.playAddr) {
                      directVideoUrl = videoItem.video.playAddr;
                      console.log('Found video URL in JSON data:', directVideoUrl);
                    }
                  }
                } catch (jsonError) {
                  console.error('Error parsing JSON data from TikTok page:', jsonError);
                }
              }
              
              // Method 2: Try regex approach
              if (!directVideoUrl) {
                const urlRegex = /"playAddr":"([^"]+)"/;
                const urlMatch = html.match(urlRegex);
                if (urlMatch && urlMatch[1]) {
                  directVideoUrl = urlMatch[1].replace(/\\u002F/g, '/');
                  console.log('Found video URL using regex:', directVideoUrl);
                }
              }
              
              if (directVideoUrl) {
                console.log('Fifth method successful. Downloading video...');
                
                const directVideoResponse = await axios({
                  method: 'GET',
                  url: directVideoUrl,
                  responseType: 'arraybuffer',
                  timeout: 30000,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': url
                  }
                });
                
                console.log('Video downloaded via fifth method, size:', directVideoResponse.data.byteLength);
                
                // Use video ID or timestamp for filename
                const fileName = videoId ? `tiktok-${videoId}.mp4` : `tiktok-${Date.now()}.mp4`;
                
                // Return the video as response
                return new NextResponse(directVideoResponse.data, {
                  headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="${fileName}"`,
                  },
                });
              } else {
                throw new Error('Fifth method failed: Could not find video URL');
              }
            } catch (fifthMethodError) {
              console.error('Fifth method also failed:', fifthMethodError);
              
              // Return detailed error for all failed methods
          return NextResponse.json({ 
            error: 'Failed to download video with all methods', 
            details: error.message,
            alternateError: alternateError.message,
            thirdMethodError: thirdMethodError.message,
                fourthMethodError: fourthMethodError.message,
                fifthMethodError: fifthMethodError.message,
            url: url 
          }, { status: 500 });
            }
          }
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