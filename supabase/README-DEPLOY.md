# نشر وظائف Edge Functions من لوحة تحكم Supabase

هذا الملف يتضمن تعليمات خطوة بخطوة لنشر وظائف Edge Functions من لوحة تحكم Supabase بدون استخدام Docker أو Supabase CLI.

## الخطوات

### 1. تسجيل الدخول إلى لوحة تحكم Supabase

افتح [لوحة تحكم Supabase](https://supabase.com/dashboard) واختر مشروعك (`ycucolbmqjqzhfgiteih`).

### 2. إنشاء وظائف Edge Functions

1. انتقل إلى قسم **Edge Functions** من القائمة الجانبية
2. انقر على زر **New Function** لإنشاء وظيفة جديدة
3. قم بإنشاء الوظائف التالية:
   - `process-videos`
   - `process-single-video`
   - `process-cron`

لكل وظيفة، انسخ والصق الكود من ملف `supabase/EDGE-FUNCTIONS.md` في محرر الكود.

### 3. إعداد متغيرات البيئة

انتقل إلى **Settings** > **API** > **Edge Functions** وأضف المتغيرات التالية:

```
SUPABASE_URL=https://ycucolbmqjqzhfgiteih.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljdWNvbGJtcWpxemhmZ2l0ZWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NTQxMjEsImV4cCI6MjA2MjEzMDEyMX0.BKxsAV_07vqcZ5VPCuyV6WXFHhwzotWnZnim9DCT59k
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljdWNvbGJtcWpxemhmZ2l0ZWloIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjU1NDEyMSwiZXhwIjoyMDYyMTMwMTIxfQ.rKQ3cKBXodZZYPf466tjOAKtRRFNBXfDWUsm4BGqkuM
CRON_API_KEY=youtube_uploader_secure_cron_key_12345
API_URL=https://uplouder-youtube.vercel.app
```

**ملاحظة هامة**: غيّر `API_URL` إلى عنوان URL الفعلي للموقع في الإنتاج، مثل `https://yourappdomain.com`

### 4. إعداد وظيفة Cron

#### إعداد وظيفة تشغيل كل 10 دقائق

1. انتقل إلى **Edge Functions** > **process-cron**
2. انقر على **Schedules**
3. أضف جدول جديد باستخدام التعبير Cron التالي:
   ```
   */10 * * * *
   ```
   (هذا سيشغل الوظيفة كل 10 دقائق)

#### إعداد وظيفة إعادة تعيين يومية

أضف جدول آخر يعمل في منتصف الليل لإعادة تعيين العدادات اليومية:
```
0 0 * * *
```

### 5. اختبار الوظائف

1. انتقل إلى وظيفة **process-videos**
2. انقر على زر **Invoke** لاختبار الوظيفة
3. أضف الوسيط التالي للاختبار:
   ```json
   {
     "batchSize": 8
   }
   ```
4. تحقق من سجل الاستجابة للتأكد من أن الوظيفة تعمل بشكل صحيح

## تحديث تطبيق Next.js

للتأكد من أن تطبيقك يستخدم وظائف Edge Functions:

1. أضف متغير البيئة `NEXT_PUBLIC_USE_EDGE_FUNCTIONS="true"` إلى ملف `.env.local` وإلى إعدادات البيئة في Vercel
2. تأكد من أن `src/app/api/trigger-processing/route.js` يستخدم هذا المتغير للتبديل بين معالجة API المحلية ووظائف Edge Functions

## ملاحظات أمان

- لا تشارك ملفات `.env` التي تحتوي على مفاتيح وأسرار
- استخدم مفاتيح API آمنة وقوية لمصادقة وظائف Cron
- تحقق دائمًا من المصادقة قبل معالجة الفيديوهات 