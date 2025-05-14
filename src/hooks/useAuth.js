import { useState, useEffect } from 'react';
import { useSession } from '@/auth';
import { createClient } from '@supabase/supabase-js';

// إنشاء عميل Supabase
// Using fallback values for development
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
        // For development, return mock data instead of querying Supabase
        const mockUserData = {
          id: session.user.id || '1',
          email: session.user.email,
          name: session.user.name,
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setUserData(mockUserData);
        setIsAdmin(mockUserData.role === 'admin');
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