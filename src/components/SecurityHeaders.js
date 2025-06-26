'use client';

import { useEffect } from 'react';

/**
 * Security Headers Component
 * يطبق CSP فقط عبر meta tag لأن باقي الـ headers لازم تتطبق من الخادم
 */
export default function SecurityHeaders() {
  useEffect(() => {
    // تطبيق Content Security Policy فقط (الوحيد اللي يشتغل مع meta tags)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://youtube.googleapis.com",
      "frame-src 'self' https://accounts.google.com",
      "media-src 'self' https: blob:",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ');
    
    // التحقق من عدم وجود CSP meta tag مسبقاً
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!existingCSP) {
      const cspMeta = document.createElement('meta');
      cspMeta.httpEquiv = 'Content-Security-Policy';
      cspMeta.content = csp;
      document.head.appendChild(cspMeta);
      
      // تنظيف عند إلغاء تحميل المكون
      return () => {
        if (cspMeta && cspMeta.parentNode) {
          cspMeta.parentNode.removeChild(cspMeta);
        }
      };
    }
  }, []);

  // هذا المكون لا يعرض أي محتوى مرئي
  return null;
}