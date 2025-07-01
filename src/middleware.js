import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Performance optimizations - cached configurations
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = process.env.NODE_ENV === 'development' ? 1000 : 100;
const rateLimitMap = new Map();

// Optimized security patterns with compiled regex
const SECURITY_PATTERNS = {
  XSS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi
  ],
  SQL_INJECTION: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /('|(\\')|(;)|(--)|(\|)|(\*)|(%27)|(%3D)|(%3B)|(%2D%2D))/gi
  ],
  PATH_TRAVERSAL: [
    /\.\.[\/\\]/g,
    /%2e%2e[\/\\]/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi
  ]
};

// Cache for admin users to reduce repeated checks
const adminCache = new Map();
const ADMIN_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Optimized rate limiting with memory cleanup
function rateLimit(ip) {
  // Skip rate limiting in development for localhost
  if (process.env.NODE_ENV === 'development' && 
      (ip === 'unknown' || ip.includes('127.0.0.1') || ip.includes('localhost'))) {
    return true;
  }

  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }
  
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  
  // Periodic cleanup to prevent memory leaks
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.length === 0 || Math.max(...value) < windowStart) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  return true;
}

// Optimized input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // Use a single pass for all replacements
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"&]/g, (match) => {
      const entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
      return entities[match];
    });
}

// Optimized security threat detection
function detectSecurityThreats(input) {
  if (typeof input !== 'string') return [];
  
  const threats = [];
  
  // Use some() for early termination
  if (SECURITY_PATTERNS.XSS.some(pattern => pattern.test(input))) {
    threats.push('XSS');
  }
  
  if (SECURITY_PATTERNS.SQL_INJECTION.some(pattern => pattern.test(input))) {
    threats.push('SQL_INJECTION');
  }
  
  if (SECURITY_PATTERNS.PATH_TRAVERSAL.some(pattern => pattern.test(input))) {
    threats.push('PATH_TRAVERSAL');
  }
  
  return threats;
}

// Optimized logging with throttling
const logThrottle = new Map();
function logSecurityEvent(event, details = {}) {
  const logKey = `${event}-${details.ip || 'unknown'}`;
  const now = Date.now();
  
  // Throttle identical events from same IP (max 1 per minute)
  if (logThrottle.has(logKey) && now - logThrottle.get(logKey) < 60000) {
    return;
  }
  
  logThrottle.set(logKey, now);
  
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    details,
    environment: process.env.NODE_ENV
  };
  
  if (process.env.NODE_ENV === 'production') {
    console.warn('Security Event:', JSON.stringify(logData));
  } else {
    console.warn('Security Event:', logData);
  }
  
  // Cleanup old throttle entries
  if (logThrottle.size > 100) {
    for (const [key, timestamp] of logThrottle.entries()) {
      if (now - timestamp > 300000) { // 5 minutes
        logThrottle.delete(key);
      }
    }
  }
}

// Cached admin check
function isAdminUser(email) {
  const cached = adminCache.get(email);
  if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL) {
    return cached.isAdmin;
  }
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  const isAdmin = adminEmails.includes(email);
  
  adminCache.set(email, {
    isAdmin,
    timestamp: Date.now()
  });
  
  return isAdmin;
}

// Pre-compiled security headers for better performance
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com https://youtube.googleapis.com",
  "frame-src 'self' https://accounts.google.com",
  "media-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export const config = {
  matcher: [
    /*
     * Match all request paths except for those that start with:
     * - /api (API routes)
     * - /_next/static (Next.js static files)
     * - /_next/image (Next.js image optimization files)
     * - /favicon.ico (favicon file)
     * - Any files that have an extension (e.g., .txt, .js, .css, etc.)
     *
     * This ensures that the middleware does not run on static files and internal Next.js resources,
     * thereby preventing the .txt file from being redirected.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\..+$).*)',
  ],
};

export default withAuth(
  function middleware(req) {
    const startTime = Date.now();
    
    // Get client info efficiently
    const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const pathname = req.nextUrl.pathname;
    
    // Early security validation for query parameters
    const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const suspiciousParams = [];
    
    for (const [key, value] of Object.entries(queryParams)) {
      const threats = detectSecurityThreats(value);
      if (threats.length > 0) {
        suspiciousParams.push({ param: key, threats });
        logSecurityEvent('SUSPICIOUS_QUERY_PARAM', {
          ip, userAgent, pathname, param: key, threats
        });
      }
    }
    
    // Block requests with security threats
    if (suspiciousParams.length > 0) {
      logSecurityEvent('REQUEST_BLOCKED_SECURITY_THREAT', {
        ip, userAgent, pathname, threatCount: suspiciousParams.length
      });
      
      return new NextResponse('Request blocked due to security concerns', { 
        status: 400,
        headers: {
          'X-Security-Block': 'true',
          'X-Block-Reason': 'Suspicious content detected'
        }
      });
    }
    
    // Development HTTPS to HTTP redirect
    if (process.env.NODE_ENV === 'development' && 
        req.nextUrl.protocol === 'https:' && 
        req.nextUrl.hostname === 'localhost') {
      const httpUrl = new URL(req.nextUrl);
      httpUrl.protocol = 'http:';
      return NextResponse.redirect(httpUrl);
    }
    
    // Apply rate limiting
    if (!rateLimit(ip)) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip, userAgent, pathname });
      
      return new NextResponse('Too Many Requests', { 
        status: 429,
        headers: {
          'Retry-After': '900',
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
        }
      });
    }
    
    const response = NextResponse.next();
    
    // Apply security headers efficiently
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    response.headers.set('Content-Security-Policy', CSP_POLICY);
    
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    } else {
      response.headers.set('X-Development-Mode', 'true');
      response.headers.set('X-Middleware-Duration', `${Date.now() - startTime}ms`);
    }
    
    // Handle account adding flow
    if (pathname === '/accounts' && req.nextUrl.searchParams.has('addingFor')) {
      const addingFor = req.nextUrl.searchParams.get('addingFor');
      
      if (!addingFor || addingFor.length > 100) {
        return NextResponse.redirect(new URL('/accounts', req.url));
      }
      
      const threats = detectSecurityThreats(addingFor);
      if (threats.length > 0) {
        logSecurityEvent('SECURITY_THREAT_IN_ADDING_FOR', { ip, userAgent, threats });
        return NextResponse.redirect(new URL('/accounts', req.url));
      }
      
      const sanitizedAddingFor = sanitizeInput(addingFor);
      if (sanitizedAddingFor.length === 0) {
        return NextResponse.redirect(new URL('/accounts', req.url));
      }
      
      response.cookies.set('addingAccountFor', sanitizedAddingFor, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 300, // 5 minutes
        path: '/accounts',
      });
    }
    
    // Admin route protection
    if (pathname.startsWith('/admin')) {
      const token = req.nextauth?.token;
      
      if (!token?.email || !isAdminUser(token.email)) {
        logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', { ip, userAgent, pathname });
        return NextResponse.redirect(new URL('/home', req.url));
      }
    }
    
    // API route CORS headers
    if (pathname.startsWith('/api/')) {
      const allowedOrigin = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.NEXTAUTH_URL || 'https://youtubeboot.com');
        
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
      
      if (req.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers: response.headers });
      }
    }
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Let API routes handle their own auth
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return true;
        }
        
        if (!token) {
          return false;
        }
        
        // Check token expiration
        if (token.exp && Date.now() >= token.exp * 1000) {
          return false;
        }
        
        return true;
      },
    },
    pages: {
      signIn: '/',
      error: '/auth/error',
    },
  }
);