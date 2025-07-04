import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { createClient } from '@supabase/supabase-js';

// إنشاء عميل Supabase مع قيم افتراضية للتطوير
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-key';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  
  // استخدام useRef لتتبع حالة الجلسة السابقة ومنع التحديثات الزائدة
  const prevSessionRef = useRef(null);
  const prevStatusRef = useRef(null);

  // استرجاع بيانات المستخدم من Supabase
  useEffect(() => {
    // تحقق من وجود تغيير فعلي في session أو status
    const sessionChanged = !prevSessionRef.current || 
      JSON.stringify(prevSessionRef.current) !== JSON.stringify(session);
    const statusChanged = prevStatusRef.current !== status;
    
    // تحديث المراجع
    prevSessionRef.current = session;
    prevStatusRef.current = status;
    
    // إذا لم يتغير شيء، لا تفعل شيئا
    if (!sessionChanged && !statusChanged) {
      return;
    }
    
    let isMounted = true;
    
    const fetchUserData = async () => {
      // إذا لم يكن لدينا جلسة، فلا داعي للاستعلام عن بيانات إضافية
      if (status === 'unauthenticated' || !session?.user?.email) {
        if (isMounted) {
          setUserData(null);
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      try {
        // في حالة التحميل، لا تفعل شيئا
        if (status === 'loading') {
          return;
        }
        
        try {
          // استعلام من Supabase للحصول على بيانات المستخدم
          const { data: userData, error: supabaseError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (supabaseError) throw supabaseError;

          if (userData) {
            if (isMounted) {
              setUserData(userData);
              setIsAdmin(userData.role === 'admin');
              setError(null);
              setLoading(false);
            }
          } else {
            console.warn('useAuth: User not found by ID on client; falling back to server-provided session data. No client-side insert performed.');
            if (isMounted) {
              setUserData({
                id: session.user.id,
                email: session.user.email,
                name: session.user.name || session.user.email?.split('@')[0] || 'User',
                role: 'user'
              });
              setIsAdmin(false);
              setLoading(false);
            }
          }
        } catch (err) {
          console.error('خطأ في استرجاع بيانات المستخدم:', err);
          if (isMounted) {
            setError(err.message);
            setLoading(false);
          }
        }
        
        if (isMounted) {
          setUserData(mockUserData);
          setIsAdmin(mockUserData.role === 'admin');
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('خطأ في استرجاع بيانات المستخدم:', err);
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    // استرجاع البيانات فقط عندما تكون حالة الجلسة ليست "قيد التحميل"
    if (status !== 'loading') {
      fetchUserData();
    }
    
    return () => {
      isMounted = false;
    };
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