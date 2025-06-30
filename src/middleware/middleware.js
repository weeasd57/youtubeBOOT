import { NextResponse } from 'next/server';

export function middleware(request) {
  const url = request.nextUrl.pathname;

  // استثناء ملف التحقق الخاص بـ TikTok لمنع إعادة التوجيه
  // Skip TikTok verification file to prevent redirection
  if (url === '/tiktok5ZKw3SRJrj79DVojdAzCN6rvN0u7HV6u.txt') {
    return NextResponse.next();
  }

  // إذا كان هناك أي منطق آخر لإعادة التوجيه (مثل إعادة التوجيه للصفحة الرئيسية للمستخدمين غير المصادق عليهم)
  // If there is any other redirect logic (e.g., redirect to home for unauthenticated users)
  // يجب وضعه هنا، وإلا فلن تكون هناك حاجة لإعادة التوجيه العامة
  // it should be placed here, otherwise there is no need for a general redirect
  // For example:
  // if (!request.nextUrl.pathname.startsWith('/api/auth') && !request.nextUrl.pathname.startsWith('/_next')) {
  //   return NextResponse.redirect(new URL('/', request.url));
  // }
  
  return NextResponse.next(); // Default to continue if no other redirect applies
} 