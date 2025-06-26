/**
 * Security utilities for input validation and sanitization
 */

// Input sanitization functions
export const sanitizeInput = {
  // Remove HTML tags and dangerous characters
  html: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[<>'"&]/g, (match) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[match];
      });
  },

  // Sanitize for URL parameters
  url: (input) => {
    if (typeof input !== 'string') return input;
    return encodeURIComponent(input).replace(/[!'()*]/g, (c) => {
      return '%' + c.charCodeAt(0).toString(16);
    });
  },

  // Sanitize file names
  filename: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  },

  // Sanitize email addresses
  email: (input) => {
    if (typeof input !== 'string') return input;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input) ? input.toLowerCase().trim() : '';
  }
};

// Input validation functions
export const validateInput = {
  // Validate email format
  email: (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  },

  // Validate URL format
  url: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Validate file size (in bytes)
  fileSize: (size, maxSize = 100 * 1024 * 1024) => { // Default 100MB
    return typeof size === 'number' && size > 0 && size <= maxSize;
  },

  // Validate file type
  fileType: (filename, allowedTypes = []) => {
    if (!filename || typeof filename !== 'string') return false;
    const extension = filename.split('.').pop()?.toLowerCase();
    return allowedTypes.length === 0 || allowedTypes.includes(extension);
  },

  // Validate YouTube video ID
  youtubeVideoId: (id) => {
    const youtubeRegex = /^[a-zA-Z0-9_-]{11}$/;
    return youtubeRegex.test(id);
  },

  // Validate Google Drive file ID
  driveFileId: (id) => {
    const driveRegex = /^[a-zA-Z0-9_-]{25,}$/;
    return driveRegex.test(id);
  }
};

// Rate limiting utilities
export class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }

    const userRequests = this.requests.get(identifier);
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  getRemainingRequests(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const userRequests = this.requests.get(identifier) || [];
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(identifier) {
    const userRequests = this.requests.get(identifier) || [];
    if (userRequests.length === 0) return Date.now();
    return Math.min(...userRequests) + this.windowMs;
  }
}

// CSRF protection utilities
export const csrfProtection = {
  generateToken: () => {
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for server-side
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  validateToken: (token, storedToken) => {
    return token && storedToken && token === storedToken;
  }
};

// Content Security Policy helpers
export const cspDirectives = {
  default: "default-src 'self'",
  scripts: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
  styles: "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  images: "img-src 'self' data: https: blob:",
  fonts: "font-src 'self' https://fonts.gstatic.com",
  connect: "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://youtube.googleapis.com",
  frames: "frame-src 'self' https://accounts.google.com",
  media: "media-src 'self' https: blob:",
  objects: "object-src 'none'",
  base: "base-uri 'self'",
  forms: "form-action 'self'",
  frameAncestors: "frame-ancestors 'none'",
  upgrade: "upgrade-insecure-requests"
};

// Error handling for security issues
export class SecurityError extends Error {
  constructor(message, code = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

// Secure headers configuration
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
};

// Utility to check if running in production
export const isProduction = () => process.env.NODE_ENV === 'production';

// Utility to log security events (in production, send to monitoring service)
export const logSecurityEvent = (event, details = {}) => {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    details,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    url: typeof window !== 'undefined' ? window.location.href : 'server'
  };

  if (isProduction()) {
    // In production, send to your monitoring service
    console.warn('Security Event:', logData);
    // Example: sendToMonitoringService(logData);
  } else {
    console.warn('Security Event:', logData);
  }
};

export default {
  sanitizeInput,
  validateInput,
  RateLimiter,
  csrfProtection,
  cspDirectives,
  SecurityError,
  securityHeaders,
  isProduction,
  logSecurityEvent
};