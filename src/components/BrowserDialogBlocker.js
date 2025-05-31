'use client';

import { useEffect } from 'react';

/**
 * مكون يقوم بتجاوز نوافذ التأكيد والتنبيه والإدخال في المتصفح
 * يساعد في منع الرسائل المزعجة التي تظهر من localhost
 */
export default function BrowserDialogBlocker() {
  useEffect(() => {
    // حفظ المراجع الأصلية لوظائف المتصفح
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;
    const originalPrompt = window.prompt;
    
    // تعريف متغير لتتبع ما إذا كان المكون مثبتًا
    window.__dialogBlockerInstalled = true;
    
    // استبدال وظائف الحوار بوظائف مخصصة
    window.confirm = function(message) {
      console.log("[DialogBlocker] Confirm blocked:", message);
      // إذا كانت الرسالة تتعلق بتبديل الحساب، نعيد true تلقائيًا
      if (message.includes('Switch to account') || 
          message.includes('Unknown email') || 
          message.toLowerCase().includes('localhost')) {
        return true;
      }
      // معالجة أنواع أخرى من رسائل التأكيد - يمكن إضافة المزيد من الحالات هنا
      return true;
    };
    
    window.alert = function(message) {
      console.log("[DialogBlocker] Alert blocked:", message);
      // لا نفعل شيئًا لمنع التنبيهات
      return undefined;
    };
    
    window.prompt = function(message, defaultValue) {
      console.log("[DialogBlocker] Prompt blocked:", message);
      // نعيد القيمة الافتراضية أو سلسلة فارغة
      return defaultValue || "";
    };
    
    console.log("[DialogBlocker] Browser dialog functions overridden");
    
    // إزالة التجاوزات عند تفكيك المكون
    return () => {
      window.confirm = originalConfirm;
      window.alert = originalAlert;
      window.prompt = originalPrompt;
      window.__dialogBlockerInstalled = false;
      console.log("[DialogBlocker] Browser dialog functions restored");
    };
  }, []);
  
  // المكون لا يعرض أي شيء في واجهة المستخدم
  return null;
} 