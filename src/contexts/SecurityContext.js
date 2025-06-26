'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  sanitizeInput, 
  validateInput, 
  RateLimiter, 
  SecurityError, 
  logSecurityEvent,
  csrfProtection 
} from '@/utils/security';

// إنشاء السياق
const SecurityContext = createContext(null);

// Rate limiters لمختلف العمليات
const rateLimiters = {
  // Rate limiter للطلبات العامة
  general: new RateLimiter(60 * 1000, 60), // 60 requests per minute
  // Rate limiter للرفع
  upload: new RateLimiter(60 * 1000, 10), // 10 uploads per minute
  // Rate limiter للجدولة
  schedule: new RateLimiter(60 * 1000, 20), // 20 schedule operations per minute
  // Rate limiter للتحديث
  refresh: new RateLimiter(30 * 1000, 10), // 10 refreshes per 30 seconds
};

/**
 * Security Provider Component
 * يوفر وظائ�� الأمان لكامل التطبيق
 */
export function SecurityProvider({ children }) {
  const { data: session, status } = useSession();
  const [csrfToken, setCsrfToken] = useState(null);
  const [securityMetrics, setSecurityMetrics] = useState({
    blockedRequests: 0,
    rateLimitHits: 0,
    securityEvents: 0
  });

  // إنشاء CSRF token عند تحميل المكون
  useEffect(() => {
    const token = csrfProtection.generateToken();
    setCsrfToken(token);
    
    // حفظ التوكن في localStorage للاستخدام في الطلبات
    if (typeof window !== 'undefined') {
      localStorage.setItem('csrf_token', token);
    }
  }, []);

  // دالة للتحقق من Rate Limiting
  const checkRateLimit = useCallback((operation, identifier) => {
    try {
      const rateLimiter = rateLimiters[operation] || rateLimiters.general;
      const userIdentifier = identifier || session?.user?.email || 'anonymous';
      
      if (!rateLimiter.isAllowed(userIdentifier)) {
        const remainingRequests = rateLimiter.getRemainingRequests(userIdentifier);
        const resetTime = rateLimiter.getResetTime(userIdentifier);
        
        logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          operation,
          userIdentifier,
          remainingRequests,
          resetTime: new Date(resetTime).toISOString()
        });
        
        setSecurityMetrics(prev => ({
          ...prev,
          rateLimitHits: prev.rateLimitHits + 1
        }));
        
        throw new SecurityError(
          `Rate limit exceeded for ${operation}. Please wait before trying again.`,
          'RATE_LIMIT_EXCEEDED'
        );
      }
      
      return {
        allowed: true,
        remaining: rateLimiter.getRemainingRequests(userIdentifier),
        resetTime: rateLimiter.getResetTime(userIdentifier)
      };
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error;
      }
      
      logSecurityEvent('RATE_LIMIT_CHECK_ERROR', {
        operation,
        error: error.message
      });
      
      // في حالة خطأ، نسمح بالطلب لتجنب كسر التطبيق
      return { allowed: true, remaining: 0, resetTime: Date.now() };
    }
  }, [session?.user?.email]);

  // دالة تنظيف وتحقق شاملة من المدخلات
  const secureInput = useCallback((input, options = {}) => {
    try {
      const {
        type = 'html', // html, url, filename, email
        maxLength = 1000,
        required = false,
        customValidation = null
      } = options;

      // التحقق من الإدخال المطلوب
      if (required && (!input || (typeof input === 'string' && !input.trim()))) {
        throw new SecurityError('Required input is missing', 'REQUIRED_INPUT_MISSING');
      }

      // إذا كان الإدخال فارغ وغير مطلوب، إرجاع قيمة فارغة
      if (!input) return '';

      // تطبيق التنظيف حسب النوع
      let sanitized;
      switch (type) {
        case 'html':
          sanitized = sanitizeInput.html(input);
          break;
        case 'url':
          sanitized = sanitizeInput.url(input);
          break;
        case 'filename':
          sanitized = sanitizeInput.filename(input);
          break;
        case 'email':
          sanitized = sanitizeInput.email(input);
          break;
        default:
          sanitized = sanitizeInput.html(input);
      }

      // التحقق من الطول
      if (sanitized.length > maxLength) {
        logSecurityEvent('INPUT_LENGTH_EXCEEDED', {
          type,
          originalLength: input.length,
          sanitizedLength: sanitized.length,
          maxLength
        });
        sanitized = sanitized.substring(0, maxLength);
      }

      // تطبيق التحقق المخصص إذا وجد
      if (customValidation && typeof customValidation === 'function') {
        const validationResult = customValidation(sanitized);
        if (!validationResult.valid) {
          throw new SecurityError(
            validationResult.message || 'Custom validation failed',
            'CUSTOM_VALIDATION_FAILED'
          );
        }
      }

      return sanitized;
    } catch (error) {
      if (error instanceof SecurityError) {
        setSecurityMetrics(prev => ({
          ...prev,
          securityEvents: prev.securityEvents + 1
        }));
        throw error;
      }
      
      logSecurityEvent('INPUT_SANITIZATION_ERROR', {
        error: error.message,
        inputType: typeof input
      });
      
      throw new SecurityError('Input processing failed', 'INPUT_PROCESSING_ERROR');
    }
  }, []);

  // دالة التحقق من صحة المدخلات
  const validateSecureInput = useCallback((input, validationType, options = {}) => {
    try {
      let isValid = false;
      
      switch (validationType) {
        case 'email':
          isValid = validateInput.email(input);
          break;
        case 'url':
          isValid = validateInput.url(input);
          break;
        case 'fileSize':
          isValid = validateInput.fileSize(input, options.maxSize);
          break;
        case 'fileType':
          isValid = validateInput.fileType(input, options.allowedTypes);
          break;
        case 'youtubeVideoId':
          isValid = validateInput.youtubeVideoId(input);
          break;
        case 'driveFileId':
          isValid = validateInput.driveFileId(input);
          break;
        default:
          logSecurityEvent('UNKNOWN_VALIDATION_TYPE', { validationType });
          return false;
      }
      
      if (!isValid) {
        logSecurityEvent('VALIDATION_FAILED', {
          validationType,
          inputLength: input ? input.length : 0
        });
      }
      
      return isValid;
    } catch (error) {
      logSecurityEvent('VALIDATION_ERROR', {
        validationType,
        error: error.message
      });
      return false;
    }
  }, []);

  // دالة للتحقق من CSRF Token
  const validateCSRF = useCallback((token) => {
    if (!csrfToken) {
      logSecurityEvent('CSRF_TOKEN_NOT_INITIALIZED');
      return false;
    }
    
    const isValid = csrfProtection.validateToken(token, csrfToken);
    
    if (!isValid) {
      logSecurityEvent('CSRF_VALIDATION_FAILED', {
        providedToken: token ? 'present' : 'missing',
        expectedToken: 'present'
      });
      
      setSecurityMetrics(prev => ({
        ...prev,
        blockedRequests: prev.blockedRequests + 1
      }));
    }
    
    return isValid;
  }, [csrfToken]);

  // دالة تسجيل الأحداث الأمنية مع إضافة معلومات السياق
  const logSecurityEventWithContext = useCallback((event, details = {}) => {
    const contextualDetails = {
      ...details,
      userEmail: session?.user?.email || 'anonymous',
      sessionStatus: status,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
    };
    
    logSecurityEvent(event, contextualDetails);
    
    setSecurityMetrics(prev => ({
      ...prev,
      securityEvents: prev.securityEvents + 1
    }));
  }, [session?.user?.email, status]);

  // دالة إنشاء طلب آمن
  const createSecureRequest = useCallback(async (url, options = {}) => {
    try {
      // التحقق من rate limiting
      const rateLimitResult = checkRateLimit('general');
      
      if (!rateLimitResult.allowed) {
        throw new SecurityError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      }

      // إضافة CSRF token للطلبات POST/PUT/DELETE
      const method = options.method || 'GET';
      if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        if (!csrfToken) {
          throw new SecurityError('CSRF token not available', 'CSRF_TOKEN_MISSING');
        }
        
        options.headers = {
          ...options.headers,
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        };
      }

      // تسجيل الطلب
      logSecurityEventWithContext('SECURE_REQUEST_INITIATED', {
        url: url.substring(0, 100), // Log only first 100 chars of URL
        method,
        hasCSRF: !!options.headers?.['X-CSRF-Token']
      });

      return fetch(url, options);
    } catch (error) {
      logSecurityEventWithContext('SECURE_REQUEST_FAILED', {
        url: url.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }, [checkRateLimit, csrfToken, logSecurityEventWithContext]);

  // القيم المتاحة في السياق
  const contextValue = {
    // Rate limiting
    checkRateLimit,
    
    // Input sanitization and validation
    secureInput,
    validateSecureInput,
    
    // CSRF protection
    csrfToken,
    validateCSRF,
    
    // Secure requests
    createSecureRequest,
    
    // Security logging
    logSecurityEvent: logSecurityEventWithContext,
    
    // Security metrics
    securityMetrics,
    
    // Utility functions
    sanitizeInput,
    validateInput,
    SecurityError
  };

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  );
}

/**
 * Hook لاستخدام السياق الأمني
 */
export function useSecurity() {
  const context = useContext(SecurityContext);
  
  if (context === null) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  
  return context;
}

/**
 * Hook للتحقق من Rate Limiting لعملية محددة
 */
export function useRateLimit(operation) {
  const { checkRateLimit } = useSecurity();
  
  return useCallback((identifier) => {
    return checkRateLimit(operation, identifier);
  }, [checkRateLimit, operation]);
}

/**
 * Hook لتنظيف المدخلات
 */
export function useSecureInput() {
  const { secureInput, validateSecureInput } = useSecurity();
  
  return {
    sanitize: secureInput,
    validate: validateSecureInput
  };
}

/**
 * Hook للطلبات الآمنة
 */
export function useSecureRequest() {
  const { createSecureRequest, logSecurityEvent } = useSecurity();
  
  return {
    secureRequest: createSecureRequest,
    logEvent: logSecurityEvent
  };
}