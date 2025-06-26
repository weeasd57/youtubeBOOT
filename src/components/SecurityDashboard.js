'use client';

import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaExclamationTriangle, FaClock, FaEye, FaChartLine, FaLock } from 'react-icons/fa';
import { useSecurity } from '@/contexts/SecurityContext';

/**
 * Security Dashboard Component
 * يعرض إحصائيات ومعلومات الأمان للمستخدمين المخولين
 */
export default function SecurityDashboard({ isAdmin = false }) {
  const { securityMetrics, logSecurityEvent } = useSecurity();
  const [isVisible, setIsVisible] = useState(false);
  const [recentEvents, setRecentEvents] = useState([]);

  // إظهار/إخفاء لوحة الأمان
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    if (!isVisible) {
      logSecurityEvent('SECURITY_DASHBOARD_OPENED', { isAdmin });
    }
  };

  // محاكاة الأحداث الأمنية الأخيرة (في التطبيق الحقيقي، ستأتي من API)
  useEffect(() => {
    if (isVisible) {
      // هنا يمكن جلب الأحداث الأمنية الأخيرة من الخادم
      setRecentEvents([
        {
          id: 1,
          type: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          severity: 'warning',
          message: 'Rate limit exceeded for upload operation'
        },
        {
          id: 2,
          type: 'SUSPICIOUS_INPUT_DETECTED',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          severity: 'high',
          message: 'XSS attempt detected in form input'
        },
        {
          id: 3,
          type: 'CSRF_VALIDATION_FAILED',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          severity: 'high',
          message: 'CSRF token validation failed'
        }
      ]);
    }
  }, [isVisible]);

  // تحديد لون الخطورة
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'info':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  // تنسيق الوقت
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* زر فتح/إغلاق لوحة الأمان */}
      <button
        onClick={toggleVisibility}
        className={`p-3 rounded-full shadow-lg transition-all duration-300 ${
          isVisible 
            ? 'bg-red-500 hover:bg-red-600 text-white' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
        title={isVisible ? 'Hide Security Dashboard' : 'Show Security Dashboard'}
      >
        {isVisible ? <FaEye /> : <FaShieldAlt />}
      </button>

      {/* لوحة الأمان */}
      {isVisible && (
        <div className="absolute bottom-16 right-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* رأس اللوحة */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaShieldAlt />
                <h3 className="font-semibold">Security Dashboard</h3>
              </div>
              <button
                onClick={toggleVisibility}
                className="text-white/80 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
          </div>

          {/* إحصائيات الأمان */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Security Metrics
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full mx-auto mb-1">
                  <FaExclamationTriangle className="text-red-600 dark:text-red-400 text-xs" />
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {securityMetrics.blockedRequests}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Blocked
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mx-auto mb-1">
                  <FaClock className="text-yellow-600 dark:text-yellow-400 text-xs" />
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {securityMetrics.rateLimitHits}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Rate Limited
                </div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full mx-auto mb-1">
                  <FaChartLine className="text-blue-600 dark:text-blue-400 text-xs" />
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {securityMetrics.securityEvents}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Events
                </div>
              </div>
            </div>
          </div>

          {/* الأحداث الأمنية الأخيرة */}
          {isAdmin && (
            <div className="p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <FaLock className="text-xs" />
                Recent Security Events
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-2 rounded-md text-xs ${getSeverityColor(event.severity)}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{event.type}</span>
                        <span className="text-xs opacity-75">
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                      <div className="opacity-90">
                        {event.message}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                    <FaShieldAlt className="mx-auto mb-2 text-lg" />
                    <div className="text-xs">No recent security events</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* معلومات إضافية للمستخدمين العاديين */}
          {!isAdmin && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
              <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                <FaLock className="inline mr-1" />
                Your data is protected by our security systems
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}