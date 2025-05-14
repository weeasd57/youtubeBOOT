/**
 * مجموعة دوال مساعدة لمعالجة عناوين الفيديوهات قبل رفعها إلى يوتيوب
 */

/**
 * تنظيف وتجهيز عنوان الفيديو
 * @param {string} title - العنوان الأصلي
 * @returns {string} - العنوان بعد التنظيف
 */
export function cleanVideoTitle(title) {
  if (!title) return '';
  
  // تنظيف العنوان من أحرف غير صالحة
  let cleanTitle = title.trim()
    // استبدل أحرف التحكم (\u0000-\u001F) والأحرف غير المرئية (\u007F-\u009F)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // استبدل الرموز الخاصة التي قد تسبب مشاكل في YouTube API
    .replace(/[<>:"\/\\|?*%&{}$~^]/g, ' ')
    // تصحيح المسافات المتعددة
    .replace(/\s+/g, ' ')
    .trim();
    
  return cleanTitle || 'Untitled Video';
}

/**
 * مراجعة العنوان وتقصيره إذا تجاوز الحد المسموح به
 * يقوم بأخذ أول 4 كلمات من العنوان إذا تجاوز 100 حرف
 * @param {string} title - العنوان الأصلي
 * @param {boolean} addShortsTag - إضافة #Shorts للعنوان (افتراضيًا: true)
 * @returns {string} - العنوان المعالج
 */
export function processVideoTitle(title, addShortsTag = true) {
  if (!title) return 'Untitled Video';
  
  // تنظيف العنوان أولاً
  let processedTitle = cleanVideoTitle(title);
  
  // إذا كان العنوان أطول من 100 حرف، أخذ أول 4 كلمات فقط
  if (processedTitle.length > 100) {
    const words = processedTitle.split(' ');
    const firstFourWords = words.slice(0, 4).join(' ');
    processedTitle = firstFourWords;
    
    // التأكد مرة أخرى من أن العنوان المختصر أقل من 100 حرف
    if (processedTitle.length > 100) {
      processedTitle = processedTitle.substring(0, 90).trim();
    }
  }
  
  // إضافة #Shorts إذا مطلوب وغير موجود بالفعل
  if (addShortsTag) {
    if (!processedTitle.includes('#Shorts') && !processedTitle.includes('#shorts')) {
      const shortsTag = ' #Shorts';
      
      // التأكد من عدم تجاوز العنوان للحد بعد إضافة #Shorts
      const maxLength = 100 - shortsTag.length;
      if (processedTitle.length > maxLength) {
        processedTitle = processedTitle.substring(0, maxLength).trim();
      }
      
      processedTitle += shortsTag;
    }
  }
  
  return processedTitle;
}

/**
 * توليد عنوان نظيف من اسم الملف
 * @param {string} fileName - اسم الملف
 * @returns {string} - العنوان النظيف
 */
export function generateCleanTitleFromFileName(fileName) {
  if (!fileName) return '';
  
  // استخراج معرف TikTok إذا كان موجودا
  let title = fileName;
  const tiktokMatch = fileName.match(/tiktok-(\d+)-(.+?)\.mp4$/i);
  
  if (tiktokMatch) {
    // استخدام الجزء بعد معرف TikTok
    title = tiktokMatch[2];
  } else {
    // إزالة امتداد الملف للملفات الأخرى
    title = fileName.replace(/\.(mp4|mov|avi|mkv|wmv)$/i, '');
  }
  
  // إزالة الهاشتاجات
  title = title.replace(/#[a-zA-Z0-9_]+/g, '').trim();
  
  // استبدال الشرطات المتعددة والشرط السفلي والمسافات بمسافة واحدة
  title = title.replace(/[_\s-]+/g, ' ').trim();
  
  // إذا كان العنوان قصيرًا جدًا أو يحتوي فقط على أحرف خاصة، استخدم عنوانًا افتراضيًا
  if (title.length < 3 || /^[\s_\-]+$/.test(title)) {
    if (tiktokMatch) {
      return `TikTok Video ${tiktokMatch[1].substring(0, 6)}`;
    } else {
      return 'Untitled Video';
    }
  }
  
  // تحويل الحرف الأول من كل كلمة إلى حرف كبير
  title = title.replace(/\b\w/g, c => c.toUpperCase());
  
  // إزالة أي مسافات إضافية
  title = title.replace(/\s+/g, ' ').trim();
  
  return title;
} 