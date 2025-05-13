import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

// إنشاء عميل Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Hook لإدارة معلومات المصادقة والجلسة
 * يوفر معلومات المستخدم، وجلسة المصادقة، وحالة التحميل
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // استرجاع بيانات المستخدم من Supabase
  useEffect(() => {
    const fetchUserData = async () => {
      // إذا لم يكن لدينا جلسة، فلا داعي للاستعلام عن بيانات إضافية
      if (status === 'unauthenticated' || !session?.user?.email) {
        setUserData(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // استعلام عن بيانات المستخدم من Supabase
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (error) throw error;

        setUserData(data);
        setIsAdmin(data?.role === 'admin');
        setError(null);
      } catch (err) {
        console.error('خطأ في استرجاع بيانات المستخدم:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // استرجاع البيانات فقط عندما تكون حالة الجلسة محملة
    if (status !== 'loading') {
      fetchUserData();
    }
  }, [session, status]);

  return {
    user: session?.user || null,
    session,
    userData,
    isAdmin,
    loading: status === 'loading' || loading,
    authenticated: !!session,
    error
  };
} 