'use client';

import { useEffect } from 'react';

/**
 * مكون يقوم بتجاوز نوافذ التأكيد والتنبيه الافتراضية في المتصفح
 */
export default function BrowserAlertBlocker() {
  useEffect(() => {
    // تجاوز نوافذ التأكيد الافتراضية في المتصفح
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;
    const originalPrompt = window.prompt;
    
    window.confirm = function(message) {
      console.log("[AlertBlocker] Browser confirm blocked:", message);
      return true; // دائما نعيد true لتجاوز التأكيد
    };
    
    window.alert = function(message) {
      console.log("[AlertBlocker] Browser alert blocked:", message);
      // لا نفعل شيئًا لإلغاء التنبيهات
    };
    
    window.prompt = function(message, defaultValue) {
      console.log("[AlertBlocker] Browser prompt blocked:", message);
      return defaultValue || ""; // نعيد القيمة الافتراضية أو سلسلة فارغة
    };

    // إرجاع الدالة الأصلية عند تفكيك المكون
    return () => {
      window.confirm = originalConfirm;
      window.alert = originalAlert;
      window.prompt = originalPrompt;
    };
  }, []);

  return null;
} 