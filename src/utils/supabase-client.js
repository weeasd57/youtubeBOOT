'use client';

import { createClient } from '@supabase/supabase-js';

// تهيئة عميل Supabase مع المتغيرات البيئية العامة
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// التحقق من وجود المفاتيح المطلوبة - فقط في وضع التطوير
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Supabase URL or Anonymous Key is missing. Please check your environment variables.');
}

// إنشاء عميل Supabase
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
      }
    }
  }
); 