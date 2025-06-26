# Security Implementation Guide

## نظرة عامة على الأمان

تم تطبيق مكتبة أمان شاملة في المشروع لحماية التطبيق والمستخدمين من التهديدات الأمنية المختلفة.

## المكونات الأمنية المطبقة

### 1. مكتبة الأمان الأساسية (`src/utils/security.js`)

#### دوال تنظيف المدخلات (Input Sanitization)
- `sanitizeInput.html()` - إزالة HTML tags والمحتوى الخطير
- `sanitizeInput.url()` - تنظيف URLs وتشفيرها
- `sanitizeInput.filename()` - تنظيف أسماء الملفات
- `sanitizeInput.email()` - تنظيف عناوين البريد الإلكتروني

#### دوال التحقق من صحة المدخلات (Input Validation)
- `validateInput.email()` - التحقق من صحة البريد الإلكتروني
- `validateInput.url()` - التحقق من صحة الروابط
- `validateInput.fileSize()` - التحقق من حجم الملفات
- `validateInput.fileType()` - التحقق من نوع الملفات
- `validateInput.youtubeVideoId()` - التحقق من معرف فيديو YouTube
- `validateInput.driveFileId()` - التحقق من معرف ملف Google Drive

#### Rate Limiting
```javascript
const rateLimiter = new RateLimiter(windowMs, maxRequests);
rateLimiter.isAllowed(identifier); // التحقق من السماح بالطلب
rateLimiter.getRemainingRequests(identifier); // عدد الطلبات المتبقية
rateLimiter.getResetTime(identifier); // وقت إعادة التعيين
```

#### CSRF Protection
- `csrfProtection.generateToken()` - إنشاء CSRF token
- `csrfProtection.validateToken()` - التحقق من صحة التوكن

#### Security Headers
- Content Security Policy (CSP)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

### 2. Security Context (`src/contexts/SecurityContext.js`)

#### الوظائف المتاحة
- `checkRateLimit(operation, identifier)` - فحص حدود المعدل
- `secureInput(input, options)` - تنظيف وتحقق شامل من المدخلات
- `validateSecureInput(input, type, options)` - التحقق من صحة المدخلات
- `validateCSRF(token)` - التحقق من CSRF token
- `createSecureRequest(url, options)` - إنشاء طلبات آمنة
- `logSecurityEvent(event, details)` - تسجيل الأحداث الأمنية

#### Rate Limiters المختلفة
- `general`: 60 طلب في الدقيقة
- `upload`: 10 رفعات في الدقيقة
- `schedule`: 20 عملية جدولة في الدقيقة
- `refresh`: 10 تحديثات كل 30 ثانية

### 3. Enhanced Middleware (`src/middleware.js`)

#### الحماية المطبقة
- فحص التهديدات الأمنية في query parameters
- Rate limiting محسن
- تسجيل الأحداث الأمنية
- حماية مسارات الإدارة
- CORS headers للـ API routes
- Security headers تلقائية

#### أنماط التهديدات المكتشفة
- **XSS**: `<script>`, `javascript:`, `on*=`, `data:text/html`
- **SQL Injection**: `SELECT`, `INSERT`, `UNION`, `OR 1=1`
- **Path Traversal**: `../`, `%2e%2e`, `..%2f`

### 4. Security Dashboard (`src/components/SecurityDashboard.js`)

#### الإحصائيات المعروضة
- عدد الطلبات المحجوبة
- عدد مرات تجاوز حدود المعدل
- عدد الأحداث الأمنية

#### للمديرين فقط
- عرض الأحداث الأمنية الأخيرة
- تفاصيل التهديدات المكتشفة
- أوقات الأحداث ومستوى الخطورة

### 5. Security Headers Component (`src/components/SecurityHeaders.js`)

ي��بق security headers من جانب العميل:
- Content Security Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy
- Permissions-Policy

## التطبيق في المكونات

### ScheduleUploadForm.js
- تنظيف جميع المدخلات (العناوين، الأوصاف، التواريخ)
- التحقق من طول المحتوى
- فحص المحتوى المشبوه
- تسجيل الأحداث الأمنية
- حماية من CSRF
- Rate limiting للعمليات

### uploads/page.js
- Rate limiting للصفحة
- تسجيل محاولات الوصول غير المصرح بها
- تنظيف البيانات المعروضة
- Security Dashboard للمديرين

## الاستخدام

### في المكونات
```javascript
import { useSecurity } from '@/contexts/SecurityContext';

function MyComponent() {
  const { secureInput, checkRateLimit, logSecurityEvent } = useSecurity();
  
  const handleInput = (value) => {
    try {
      // فحص Rate Limiting
      checkRateLimit('general');
      
      // تنظيف المدخل
      const sanitized = secureInput(value, {
        type: 'html',
        maxLength: 500,
        required: true
      });
      
      // استخدام القيمة المنظفة
      setValue(sanitized);
    } catch (error) {
      if (error instanceof SecurityError) {
        // التعامل مع خطأ الأمان
        setError(error.message);
      }
    }
  };
}
```

### في API Routes
```javascript
import { sanitizeInput, validateInput, logSecurityEvent } from '@/utils/security';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // تنظيف المدخلات
    const title = sanitizeInput.html(body.title);
    const description = sanitizeInput.html(body.description);
    
    // التحقق من صحة المدخلات
    if (!validateInput.email(body.email)) {
      logSecurityEvent('INVALID_EMAIL_FORMAT', { email: body.email });
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    
    // متابعة المعالجة...
  } catch (error) {
    logSecurityEvent('API_ERROR', { error: error.message });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

## متغيرات البيئة المطلوبة

```env
# Admin emails for security dashboard
NEXT_PUBLIC_ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Security settings
SECURITY_LOG_LEVEL=warn
RATE_LIMIT_ENABLED=true
```

## مراقبة الأمان

### تسجيل الأحداث
جميع الأحداث الأمنية يتم تسجيلها مع:
- الوقت والتاريخ
- نوع الحدث
- تفاصيل الحدث
- معلومات المستخدم
- User Agent
- عنوان IP (في الـ middleware)

### الأحداث المسجلة
- `UNAUTHORIZED_ACCESS_ATTEMPT` - محاولة وصول غير مصرح بها
- `RATE_LIMIT_EXCEEDED` - تجاوز حدود المعدل
- `SUSPICIOUS_INPUT_DETECTED` - اكتشاف مدخل مشبوه
- `CSRF_VALIDATION_FAILED` - فشل التحقق من CSRF
- `SECURITY_THREAT_DETECTED` - اكتشاف تهديد أمني
- `FORM_SUBMISSION_SECURITY_ISSUES` - مشاكل أمنية في النماذج

## أفضل الممارسات

### للمطورين
1. **استخدم دائماً** `secureInput()` لتنظيف المدخلات
2. **تحقق من** Rate Limiting قبل العمليات الحساسة
3. **سجل** الأحداث الأمنية المهمة
4. **تحقق من** CSRF tokens في النماذج
5. **استخدم** `validateInput` للتحقق من صحة البيانات

### للمديرين
1. **راقب** Security Dashboard بانتظام
2. **تحقق من** سجلات الأمان
3. **حدث** قائمة الإيميلات المخولة
4. **راجع** إعدادات Rate Limiting حسب الحاجة

## الأمان في الإنتاج

### Headers إضافية مطلوبة
```nginx
# في Nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### مراقبة الإنتاج
- إعداد تنبيهات للأحداث الأمنية الحرجة
- مراقبة معدلات الطلبات غير الطبيعية
- فحص دوري لسجلات الأمان
- تحديث منتظم لقوائم التهديدات

## الدعم والصيانة

### تحديث مكتبة الأمان
1. مراجعة أنماط التهديدات الجديدة
2. تحديث قوائم الحماية
3. تحسين خوارزميات الكشف
4. إضافة دوال تنظيف جديدة حسب الحاجة

### استكشاف الأخطاء
- تحقق من console logs للأحداث الأمنية
- راجع Security Dashboard للإحصائيات
- تحقق من إعدادات Rate Limiting
- تأكد من تطبيق Security Headers

## الخلاصة

تم تطبيق ن��ام أمان شامل يغطي:
- ✅ Input Sanitization & Validation
- ✅ Rate Limiting
- ✅ CSRF Protection  
- ✅ Security Headers
- ✅ Threat Detection
- ✅ Security Logging
- ✅ Admin Dashboard
- ✅ Middleware Protection

النظام يوفر حماية متعددة الطبقات ومراقبة مستمرة للتهديدات الأمنية.