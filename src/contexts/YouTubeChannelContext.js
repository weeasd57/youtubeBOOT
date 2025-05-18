'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { isQuotaError } from '@/utils/apiHelpers';

// Create context
const YouTubeChannelContext = createContext(null);

// Debug logger function
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const prefix = `[YouTubeChannel ${timestamp}]`;
  
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
};

// ثوابت لتحديد معدل الاستعلامات
const MIN_REFRESH_INTERVAL = 60000; // دقيقة واحدة كحد أدنى بين طلبات التحديث
const QUOTA_EXCEEDED_COOLDOWN = 3600000; // ساعة واحدة كفترة انتظار إذا تم تجاوز الحصة

// Provider component
export function YouTubeChannelProvider({ children }) {
  const [channelInfo, setChannelInfo] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  // Initialize lastChecked as a Date object with a timestamp in the past
  const [lastChecked, setLastChecked] = useState(new Date(0)); // Jan 1, 1970
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    connectionAttempts: 0,
    lastError: null,
    connectionHistory: []
  });
  
  // مراجع لتتبع وقت آخر تحديث - moved inside component
  const lastRefreshTimeRef = useRef(0);
  // مرجع لتتبع ما إذا تم تجاوز الحصة - moved inside component
  const quotaExceededTimeRef = useRef(0);

  // التحقق مما إذا كان التحديث مسموحًا بناءً على حدود المعدل - moved inside component
  const canRefresh = (forceRefresh = false) => {
    const now = Date.now();
    
    // إذا تم تجاوز الحصة، فرض فترة انتظار أطول
    if (quotaExceededTimeRef.current > 0) {
      const timeSinceQuotaExceeded = now - quotaExceededTimeRef.current;
      if (timeSinceQuotaExceeded < QUOTA_EXCEEDED_COOLDOWN) {
        return false;
      } else {
        // إعادة تعيين وقت تجاوز الحصة إذا انتهت فترة الانتظار
        quotaExceededTimeRef.current = 0;
      }
    }
    
    // التحقق من الحد الأدنى للفاصل الزمني بين عمليات التحديث
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    if (!forceRefresh && timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      return false;
    }
    
    return true;
  };

  // Log state changes for debugging
  useEffect(() => {
    debugLog('Channel state updated', {
      status: connectionStatus,
      hasChannelInfo: !!channelInfo,
      lastChecked: lastChecked ? lastChecked.toISOString() : null,
      loading,
      error
    });
  }, [channelInfo, connectionStatus, lastChecked, loading, error]);

  // Add connection attempt to history
  const addToConnectionHistory = (attempt) => {
    setDebugInfo(prev => ({
      ...prev,
      connectionAttempts: prev.connectionAttempts + 1,
      connectionHistory: [
        attempt,
        ...prev.connectionHistory.slice(0, 9) // Keep last 10 attempts
      ]
    }));
  };

  // دالة تحديث الاتصال الحقيقية
  const refreshConnection = async (forceRefresh = false) => {
    // التحقق مما إذا كان مسموحًا لنا بالتحديث بناءً على حدود المعدل
    if (!canRefresh(forceRefresh)) {
      return { 
        success: false, 
        error: 'تم تحديد المعدل. يرجى المحاولة مرة أخرى لاحقًا.',
        rateLimited: true
      };
    }
    
    // تحديث وقت آخر تحديث
    lastRefreshTimeRef.current = Date.now();
    
    const startTime = Date.now();
    const attemptId = `attempt-${Date.now()}`;
    
    try {
      // تعيين حالة التحميل
      setLoading(true);
      setError(null);
      
      // تسجيل بدء المحاولة
      debugLog('بدأت محاولة الاتصال', { attemptId, forceRefresh });
      
      // استدعاء نقطة النهاية الحقيقية
      const response = await fetch('/api/youtube/connection-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // إضافة عناوين التحكم في التخزين المؤقت إذا كان forceRefresh صحيحًا
          ...(forceRefresh ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' } : {})
        },
        // منع التخزين المؤقت إذا كان forceRefresh صحيحًا
        cache: forceRefresh ? 'no-store' : 'default'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'فشل الاتصال بواجهة برمجة تطبيقات YouTube');
      }
      
      if (data.success && data.status === 'connected') {
        // تنسيق بيانات القناة
        const channelData = {
          id: data.channelId,
          channelId: data.channelId,
          title: data.channelTitle,
          channelTitle: data.channelTitle,
          customUrl: data.customUrl || `@${data.channelTitle.toLowerCase().replace(/\s+/g, '')}`,
          thumbnailUrl: data.thumbnailUrl,
          statistics: {
            viewCount: data.viewCount.toString(),
            subscriberCount: data.subscriberCount.toString(),
            videoCount: data.videoCount.toString()
          },
          statsHidden: data.statsHidden,
          uploadsPlaylistId: data.uploadsPlaylistId,
          lastUpdated: new Date().toISOString()
        };
        
        debugLog('نجح الاتصال', channelData);
        
        setChannelInfo(channelData);
        setConnectionStatus('connected');
        const now = new Date();
        setLastChecked(now);
        
        addToConnectionHistory({
          id: attemptId,
          timestamp: now.toISOString(),
          duration: Date.now() - startTime,
          success: true,
          status: 'connected'
        });
        
        return { success: true, data: channelData };
      } else if (data.status === 'expired') {
        // معالجة المصادقة المنتهية
        setConnectionStatus('expired');
        setError('انتهت صلاحية المصادقة. يرجى تسجيل الدخول مرة أخرى.');
        throw new Error('انتهت صلاحية المصادقة');
      } else if (data.status === 'suspended') {
        // معالجة تعليق حساب YouTube
        setConnectionStatus('suspended');
        setError('تم تعليق حساب YouTube الخاص بك. يرجى زيارة موقع YouTube للحصول على المساعدة.');
        
        addToConnectionHistory({
          id: attemptId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          success: false,
          status: 'suspended',
          error: 'YouTube account suspended'
        });
        
        throw new Error('تم تعليق حساب YouTube');
      } else {
        // معالجة الأخطاء الأخرى
        throw new Error(data.message || 'خطأ غير معروف في الاتصال بـ YouTube');
      }
    } catch (err) {
      const errorDetails = {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      };
      
      debugLog('Connection error', errorDetails);
      
      // Check if this is a suspension error
      if (err.message?.includes('تم تعليق حساب YouTube') || 
          err.message?.includes('YouTube account suspended') ||
          (typeof error === 'string' && error.includes('suspended'))) {
        setConnectionStatus('suspended');
      } 
      // Don't override 'suspended' status if it was already set
      else if (connectionStatus !== 'suspended') {
        setConnectionStatus('failed');
      }
      
      setError(err.message || 'An unknown error occurred');
      // Still update lastChecked even on error
      const now = new Date();
      setLastChecked(now);
      
      // Update debug info
      setDebugInfo(prev => ({
        ...prev,
        lastError: errorDetails
      }));
      
      // Add to history if not already added by suspended handler
      if (!err.message?.includes('تم تعليق حساب YouTube')) {
        addToConnectionHistory({
          id: attemptId,
          timestamp: now.toISOString(),
          duration: Date.now() - startTime,
          success: false,
          status: connectionStatus, // Use the current status which might be 'suspended'
          error: err.message
        });
      }
      
      // في حالة الخطأ، تحقق مما إذا كان خطأ تجاوز الحصة
      if (isQuotaError(err)) {
        quotaExceededTimeRef.current = Date.now(); // وضع علامة على أنه تم تجاوز الحصة
        setConnectionStatus('quota_exceeded');
        setError('تم تجاوز حصة واجهة برمجة تطبيقات YouTube. يرجى المحاولة مرة أخرى لاحقًا.');
      }
      
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
      debugLog('Connection attempt finished', { 
        attemptId, 
        duration: Date.now() - startTime 
      });
    }
  };

  // Mock reset cache function
  const resetCache = () => {
    debugLog('Resetting cache');
    setChannelInfo(null);
    setLastChecked(new Date()); // Set to current time when resetting
    
    // Add to history
    addToConnectionHistory({
      id: `reset-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'reset-cache'
    });
  };

  // إعادة تعيين حالة تجاوز الحصة (للتجاوز اليدوي)
  const resetQuotaExceeded = () => {
    quotaExceededTimeRef.current = 0;
    debugLog('تم إعادة تعيين حالة تجاوز الحصة');
  };

  const getDebugReport = () => {
    return {
      ...debugInfo,
      currentState: {
        connectionStatus,
        hasChannelInfo: !!channelInfo,
        lastChecked: lastChecked ? lastChecked.toISOString() : null,
        error,
        rateLimiting: {
          lastRefreshTime: new Date(lastRefreshTimeRef.current).toISOString(),
          quotaExceededTime: quotaExceededTimeRef.current ? 
            new Date(quotaExceededTimeRef.current).toISOString() : null,
          nextAllowedRefreshTime: new Date(
            Math.max(
              lastRefreshTimeRef.current + MIN_REFRESH_INTERVAL,
              quotaExceededTimeRef.current ? quotaExceededTimeRef.current + QUOTA_EXCEEDED_COOLDOWN : 0
            )
          ).toISOString(),
          canRefreshNow: canRefresh(false)
        }
      }
    };
  };

  const value = {
    channelInfo,
    connectionStatus,
    lastChecked,
    loading,
    error,
    refreshConnection,
    resetCache,
    resetQuotaExceeded,
    debugInfo,
    getDebugReport
  };

  return <YouTubeChannelContext.Provider value={value}>{children}</YouTubeChannelContext.Provider>;
}

// Custom hook for using the context
export function useYouTubeChannel() {
  const context = useContext(YouTubeChannelContext);
  if (context === null) {
    throw new Error('useYouTubeChannel must be used within a YouTubeChannelProvider');
  }
  return context;
} 