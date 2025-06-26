'use client';

import { useEffect, useRef } from 'react';

/**
 * مكون يقوم بتجاوز نوافذ التأكيد والتنبيه والإدخال في المتصفح
 * يساعد في منع الرسائل المزعجة التي تظهر من localhost
 */
export default function BrowserDialogBlocker() {
  // Use refs to track original functions and installation state
  const originalFunctions = useRef({
    confirm: null,
    alert: null,
    prompt: null
  });
  
  const isInstalled = useRef(false);
  
  // Use a static flag to prevent multiple instances from fighting each other
  if (typeof window !== 'undefined' && !window.__dialogBlockerInitialized) {
    window.__dialogBlockerInitialized = false;
  }
  
  useEffect(() => {
    // Skip in SSR context
    if (typeof window === 'undefined') return;
    
    // Only install if not already installed
    if (window.__dialogBlockerInstalled || isInstalled.current || window.__dialogBlockerInitialized) {
      console.debug("[DialogBlocker] Dialog blocker already installed, skipping");
      return () => {}; // Return empty cleanup function
    }
    
    // Mark as installing to prevent race conditions
    window.__dialogBlockerInitialized = true;
    
    // حفظ المراجع الأصلية لوظائف المتصفح
    originalFunctions.current = {
      confirm: window.confirm,
      alert: window.alert,
      prompt: window.prompt
    };
    
    // تعريف متغير لتتبع ما إذا كان المكون مثبتًا
    window.__dialogBlockerInstalled = true;
    isInstalled.current = true;
    
    // استبدال وظائف الحوار بوظائف مخصصة
    window.confirm = function(message) {
      // Skip logging for most confirms to reduce console noise
      if (message?.includes('important')) {
        console.log("[DialogBlocker] Confirm blocked:", message);
      }
      
      // إذا كانت الرسالة تتعلق بتبديل الحساب، نعيد true تلقائيًا
      if (message?.includes('Switch to account') || 
          message?.includes('Unknown email') || 
          message?.toLowerCase()?.includes('localhost')) {
        return true;
      }
      
      // For initialization or loading related messages, return true
      if (message?.toLowerCase()?.includes('initializ') || 
          message?.toLowerCase()?.includes('loading') ||
          message?.toLowerCase()?.includes('refresh')) {
        return true;
      }
      
      // For other messages, let them through to the original confirm
      return originalFunctions.current.confirm(message);
    };
    
    window.alert = function(message) {
      // Only log crucial alerts
      if (message?.toLowerCase()?.includes('error') || 
          message?.toLowerCase()?.includes('fail') ||
          message?.toLowerCase()?.includes('timeout')) {
        console.log("[DialogBlocker] Critical alert detected:", message);
        return originalFunctions.current.alert(message);
      }
      
      // Block non-critical alerts silently
      return undefined;
    };
    
    window.prompt = function(message, defaultValue) {
      // Silently handle prompts
      return defaultValue || "";
    };
    
    console.log("[DialogBlocker] Browser dialog functions overridden");
    
    // إزالة التجاوزات عند تفكيك المكون
    return () => {
      // Only restore if we were the ones who overrode them
      if (window.__dialogBlockerInstalled && isInstalled.current && originalFunctions.current.confirm) {
        window.confirm = originalFunctions.current.confirm;
        window.alert = originalFunctions.current.alert;
        window.prompt = originalFunctions.current.prompt;
        window.__dialogBlockerInstalled = false;
        window.__dialogBlockerInitialized = false;
        isInstalled.current = false;
        console.log("[DialogBlocker] Browser dialog functions restored");
      }
    };
  }, []);
  
  // المكون لا يعرض أي شيء في واجهة المستخدم
  return null;
} 