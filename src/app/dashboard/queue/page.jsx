import { Suspense } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import DashboardHeader from '@/components/DashboardHeader';
import ProcessingStats from '@/components/ProcessingStats';
import QueueDataTable from '@/components/QueueDataTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata = {
  title: 'إدارة طابور الفيديو',
  description: 'إدارة وتتبع حالة معالجة مقاطع الفيديو',
};

export default async function QueuePage() {
  const session = await getServerSession(authOptions);
  
  // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول إذا لم يكن مصادقًا
  if (!session) {
    redirect('/api/auth/signin?callbackUrl=/dashboard/queue');
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <DashboardHeader
        title="إدارة طابور الفيديو"
        description="إدارة ومراقبة حالة معالجة جميع مقاطع الفيديو"
      />
      
      <div className="space-y-6">
        {/* بطاقة إحصائيات المعالجة */}
        <Suspense fallback={<div>جاري تحميل الإحصائيات...</div>}>
          <ProcessingStats />
        </Suspense>
        
        {/* علامات تبويب لأنواع العرض المختلفة */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">جميع الفيديوهات</TabsTrigger>
            <TabsTrigger value="pending">في الانتظار</TabsTrigger>
            <TabsTrigger value="processing">قيد المعالجة</TabsTrigger>
            <TabsTrigger value="completed">مكتملة</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <Suspense fallback={<div>جاري تحميل البيانات...</div>}>
              <QueueDataTable filterStatus={null} />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="pending">
            <Suspense fallback={<div>جاري تحميل البيانات...</div>}>
              <QueueDataTable filterStatus="pending" />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="processing">
            <Suspense fallback={<div>جاري تحميل البيانات...</div>}>
              <QueueDataTable filterStatus="processing" />
            </Suspense>
          </TabsContent>
          
          <TabsContent value="completed">
            <Suspense fallback={<div>جاري تحميل البيانات...</div>}>
              <QueueDataTable filterStatus="completed" />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 