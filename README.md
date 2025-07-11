# تطبيق YouTube Boot - توثيق شامل

تطبيق YouTube Boot هو نظام متكامل للتعامل مع الفيديوهات من TikTok ونقلها إلى Google Drive مع إمكانية النشر على YouTube. يستخدم التطبيق تقنيات متعددة مثل Next.js وSupabase وEdge Functions وCron Jobs.

## نظرة عامة على النظام

التطبيق يعمل بالتدفق التالي:

1. **مصادقة المستخدم**: تسجيل دخول المستخدمين باستخدام Google OAuth
2. **تحميل فيديوهات TikTok**: إضافة روابط فيديو TikTok للتنزيل
3. **معالجة الفيديو**: تنزيل الفيديوهات ومعالجتها تلقائياً
4. **تخزين الفيديو**: حفظ الفيديوهات في Google Drive
5. **جدولة الرفع**: جدولة نشر الفيديوهات على YouTube

## قاعدة البيانات

### جداول Supabase الرئيسية

| اسم الجدول | الوصف | العلاقات | الحقول الرئيسية |
|------------|-------|---------|-----------------|
| `users` | معلومات المستخدمين | - | `email`, `name`, `role`, `drive_folder_id` |
| `user_tokens` | رموز OAuth للوصول إلى الخدمات | `user_email → users.email` | `user_email`, `access_token`, `refresh_token`, `expires_at` |
| `video_queue` | قائمة انتظار معالجة فيديوهات TikTok | `user_email → users.email` | `id`, `user_email`, `video_id`, `url`, `status` |
| `tiktok_videos` | معلومات فيديوهات TikTok المعالجة | `user_email → users.email` | `id`, `user_email`, `video_id`, `title`, `drive_file_id` |
| `scheduled_uploads` | الفيديوهات المجدولة للنشر على YouTube | `user_email → users.email` | `id`, `user_email`, `file_id`, `scheduled_time`, `status` |
| `processing_stats` * | إحصائيات معالجة الفيديوهات (اختياري) | - | `id`, `videos_processed_today`, `videos_failed_today` |

\* *ملاحظة: جدول `processing_stats` اختياري ويستخدم لتتبع إحصائيات معالجة الفيديو. يمكن إنشاؤه باستخدام النص البرمجي المتوفر في `scripts/create-processing-stats-table.sql`*

## واجهات API (Endpoints)

### واجهات معالجة TikTok

| المسار | الطريقة | الوصف | المعلمات | الجداول المستخدمة |
|---------|--------|-------|---------|-------------------|
| `/api/tiktok-download` | POST | تنزيل فيديو TikTok | `url` | - |
| `/api/tiktok-videos` | GET | قائمة فيديوهات المستخدم | - | `tiktok_videos` |
| `/api/tiktok-videos` | POST | إضافة فيديو جديد للمعالجة | `url`, `title` | `video_queue` |
| `/api/process-videos` | POST | معالجة دفعة من الفيديوهات | `batchSize`, `userEmail` | `video_queue`, `users` |
| `/api/process-single-video` | POST | معالجة فيديو واحد | `videoId` | `video_queue`, `users` |
| `/api/trigger-processing` | POST | تشغيل دورة معالجة | `manual`, `userOnly` | `video_queue`, `processing_stats` |

### واجهات Google Drive

| المسار | الطريقة | الوصف | المعلمات | الجداول المستخدمة |
|---------|--------|-------|---------|-------------------|
| `/api/drive-folders` | GET | قائمة مجلدات المستخدم في Drive | - | `users` |
| `/api/drive-folder-files` | GET | قائمة ملفات المجلد في Drive | `folderId` | `users`, `user_tokens` |
| `/api/drive-files` | GET | قائمة ملفات المستخدم | - | `users`, `user_tokens` |
| `/api/drive-refreshtoken` | POST | تحديث رمز الوصول لـ Drive | - | `user_tokens` |

### واجهات YouTube

| المسار | الطريقة | الوصف | المعلمات | الجداول المستخدمة |
|---------|--------|-------|---------|-------------------|
| `/api/youtube` | GET | معلومات حساب YouTube | - | `users`, `user_tokens` |
| `/api/schedule-upload` | POST | جدولة نشر فيديو | `fileId`, `title`, `description`, `scheduledTime` | `scheduled_uploads` |
| `/api/scheduled-uploads` | GET | قائمة النشر المجدول | - | `scheduled_uploads` |

### واجهات Cron

| المسار | الطريقة | الوصف | التكرار | الجداول المستخدمة |
|---------|--------|-------|---------|-------------------|
| `/api/cron/process-video-batch` | GET | معالجة دفعة من الفيديوهات (كرون) | كل 5 دقائق | `video_queue`, `processing_stats` |
| `/api/cron/process-scheduled-uploads` | GET | تنفيذ النشر المجدول (كرون) | كل 5 دقائق | `scheduled_uploads` |
| `/api/check-new-videos` | GET | البحث عن فيديوهات جديدة | كل ساعة | `tiktok_videos`, `video_queue` |

## Edge Functions

Edge Functions هي وظائف تعمل على خوادم Supabase وتنفذ عمليات معالجة الفيديو. أهمها:

| الوظيفة | الوصف | الجداول المستخدمة |
|---------|-------|-------------------|
| `process-videos` | معالجة دفعة من الفيديوهات | `video_queue`, `users` |
| `process-single-video` | معالجة فيديو واحد | `video_queue`, `users` |
| `process-cron` | الوظيفة المجدولة للمعالجة | `video_queue`, `processing_stats` |

## صفحات التطبيق

| المسار | الوصف | الوظائف |
|---------|-------|--------|
| `/` | الصفحة الرئيسية | تسجيل الدخول والترحيب |
| `/dashboard` | لوحة التحكم | نظرة عامة على الإحصائيات |
| `/tiktok-videos` | قائمة فيديوهات TikTok | عرض وإضافة فيديوهات TikTok |
| `/uploader` | أداة رفع TikTok | رفع فيديوهات TikTok |
| `/uploads` | جدولة نشر على YouTube | إدارة النشر المجدول |
| `/admin` | صفحة المسؤول | إدارة المستخدمين والإحصائيات (للمسؤولين فقط) |

## دورة حياة معالجة الفيديو

1. **إضافة الرابط**: يضيف المستخدم رابط فيديو TikTok عبر `/tiktok-videos`
2. **إضافة للقائمة**: يضاف الفيديو إلى جدول `video_queue` بحالة `pending`
3. **معالجة تلقائية**: 
   - وظيفة الكرون تعمل كل 5 دقائق عبر `/api/cron/process-video-batch`
   - أو يمكن للمستخدم بدء المعالجة يدويًا عبر زر "معالجة الآن"
4. **تنزيل ومعالجة**: 
   - تغيير حالة الفيديو إلى `processing` 
   - تنزيل الفيديو من TikTok 
   - رفع الفيديو إلى Google Drive في مجلد المستخدم
5. **إكمال العملية**: 
   - تغيير حالة الفيديو إلى `completed` 
   - إضافة الفيديو إلى جدول `tiktok_videos`
   - تحديث إحصائيات المعالجة

## إعدادات Vercel

### متغيرات البيئة الرئيسية

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
CRON_API_KEY=
```

### وظائف Cron على Vercel

| المسار | التعبير | الوصف |
|---------|--------|-------|
| `/api/cron/process-video-batch` | `*/5 * * * *` | معالجة قائمة الفيديو كل 5 دقائق |
| `/api/cron/process-scheduled-uploads` | `*/5 * * * *` | معالجة النشر المجدول كل 5 دقائق |

## نصائح للاستكشاف وإصلاح الأخطاء

1. **سجلات الأخطاء**: راجع سجلات Vercel لتشخيص مشاكل API والكرون
2. **حالات الفيديو**: إذا توقفت معالجة الفيديو، تحقق من حالته في جدول `video_queue`
3. **رموز الوصول**: إذا فشلت عمليات Drive أو YouTube، تحقق من رموز الوصول في `user_tokens`
4. **جدولة الكرون**: تأكد من تكوين وظائف Cron على Vercel بشكل صحيح

## ترحيل رموز الوصول من `users` إلى `user_tokens`

إذا كنت تستخدم نسخة قديمة من التطبيق التي كانت تخزن رموز الوصول في جدول `users` مباشرة، يجب ترحيل هذه الرموز إلى جدول `user_tokens` الجديد:

1. تأكد من تثبيت المتطلبات:
```bash
npm install dotenv @supabase/supabase-js
```

2. قم بتنفيذ نص الترحيل:
```bash
node scripts/migrate-tokens.js
```

هذا النص سيقوم بما يلي:
- التحقق من وجود أعمدة رموز في جدول `users`
- نقل رموز الوصول والتحديث من `users` إلى `user_tokens`
- المحافظة على تناسق البيانات وتجنب التكرار

> **ملاحظة مهمة**: بعد الترحيل، سيستخدم التطبيق دائمًا جدول `user_tokens` للرموز، حتى إذا كانت موجودة أيضًا في جدول `users`.

## إنشاء جدول إحصائيات المعالجة

إذا لاحظت أن جدول `processing_stats` غير موجود في قاعدة البيانات الخاصة بك، يمكنك إنشاؤه باتباع الخطوات التالية:

1. قم بنسخ النص البرمجي من ملف `scripts/create-processing-stats-table.sql`
2. انتقل إلى لوحة تحكم Supabase وافتح محرر SQL
3. الصق النص البرمجي وقم بتنفيذه
4. أو بدلاً من ذلك، يمكنك تنفيذ الأمر التالي من سطر الأوامر:

```bash
# تأكد من تثبيت أدوات Supabase CLI
supabase db execute -f scripts/create-processing-stats-table.sql
```

لاحظ أن التطبيق مصمم للعمل بشكل صحيح حتى في حالة عدم وجود هذا الجدول، وذلك من خلال استخدام وظائف المساعدة الموجودة في `src/utils/stats-helpers.js`.


## معالجة الفيديوهات المتعددة (الكميات الكبيرة)

عندما يكون هناك عدد كبير من الفيديوهات في قائمة الانتظار (مثل 50 فيديو أو أكثر)، يتبع النظام آلية معالجة دفعات لتجنب تجاوز حدود API وضمان الاستقرار:

### دورة معالجة الدفعات الكبيرة

1. **تحديد حجم الدفعة**: النظام يحدد تلقائيًا عدد الفيديوهات التي سيتم معالجتها في كل دورة (الإعداد الافتراضي: 5-10 فيديوهات)

2. **ترتيب المعالجة**: 
   - الفيديوهات تتم معالجتها بترتيب FIFO (الأول في الإدخال، الأول في المعالجة)
   - يمكن تعديل الأولوية لبعض الفيديوهات من خلال تغيير حقل `priority` في قاعدة البيانات

3. **التوزيع الزمني والتقسيم**:
   - دورة الكرون تعمل كل 5 دقائق وتعالج عدد محدود من الفيديوهات
   - مثال: لمعالجة 50 فيديو بمعدل 10 فيديوهات لكل دورة، ستستغرق العملية 5 دورات (25 دقيقة)

4. **التحكم في الضغط**:
   - النظام يراقب استهلاك API ويقلل حجم الدفعة تلقائيًا عند الاقتراب من حدود الاستخدام
   - يتم تسجيل إحصائيات المعالجة في `processing_stats` للمراقبة والتحسين

5. **معالجة حالات الفشل والإعادة**:
   - الفيديوهات التي تفشل في المعالجة تُوضع في قائمة الانتظار للمحاولة مرة أخرى
   - بعد 3 محاولات فاشلة، يتم وضع علامة `failed` وإرسال إشعار (إذا تم تكوين الإشعارات)

### تخصيص إعدادات المعالجة الضخمة

يمكن تخصيص سلوك معالجة الدفعات الكبيرة من خلال تعديل متغيرات البيئة:


### مراقبة معالجة الدفعات الكبيرة

يمكن للمسؤولين مراقبة حالة معالجة الدفعات من خلال:

1. **لوحة التحكم**: تعرض إحصائيات حول عدد الفيديوهات في قائمة الانتظار والمعالجة والمكتملة
2. **سجلات النظام**: تقدم معلومات تفصيلية حول كل دورة معالجة
3. **إشعارات**: يمكن تكوين النظام لإرسال إشعارات عند اكتمال دفعة كبيرة أو حدوث أخطاء متكررة

> **نصيحة للمسؤولين**: عند الحاجة لمعالجة كميات كبيرة (أكثر من 100 فيديو)، يوصى بزيادة فترات تشغيل الكرون مؤقتًا (من 5 دقائق إلى دقيقة واحدة) من خلال لوحة تحكم Vercel.

## ملخص تكنولوجيات النظام

1. **الواجهة الأمامية**: Next.js 14 مع React 18
2. **قاعدة البيانات**: Supabase (PostgreSQL)
3. **التخزين**: Google Drive API
4. **المصادقة**: NextAuth.js مع Google OAuth
5. **المعالجة الخلفية**: Edge Functions وCron Jobs
6. **استضافة**: Vercel

## إعداد وظائف Cron باستخدام cron-job.org

تم استبدال وظائف Cron الخاصة بـ Vercel بخدمة [cron-job.org](https://console.cron-job.org/jobs) للحصول على مزيد من المرونة والتحكم في جدولة المهام.

### خطوات الإعداد:

1. قم بالتسجيل في [cron-job.org](https://console.cron-job.org/signup)
2. بعد تسجيل الدخول، انقر على "Create cronjob"
3. قم بإعداد المهام التالية:

#### مهمة 1: معالجة دفعة الفيديوهات
- **العنوان**: Process Video Batch
- **URL**: `https://[project-name-on-vercel].vercel.app/api/cron/process-video-batch`
- **الطريقة**: GET
- **الجدول الزمني**: كل 10 دقائق (*/10 * * * *)
- **الرؤوس الإضافية**:
  - الاسم: `Authorization`
  - القيمة: `Bearer YOUR_CRON_API_KEY`

#### مهمة 2: معالجة التحميلات المجدولة
- **العنوان**: Process Scheduled Uploads
- **URL**: `https://[project-name-on-vercel].vercel.app/api/cron/process-scheduled-uploads`
- **الطريقة**: GET
- **الجدول الزمني**: مرة واحدة يوميا في الساعة 9 صباحًا (0 9 * * *)
- **الرؤوس الإضافية**:
  - الاسم: `Authorization`
  - القيمة: `Bearer YOUR_CRON_API_KEY`

### مزايا استخدام cron-job.org:
- لوحة تحكم مخصصة لإدارة وظائف Cron
- سهولة تعديل الجداول الزمنية بدون الحاجة لإعادة نشر التطبيق
- خيارات متقدمة لمراقبة نجاح/فشل المهام وتلقي إشعارات في حالة الفشل
- المزيد من التحكم في محاولات إعادة المحاولة في حالة فشل المهمة
- تجاوز حدود Vercel للعدد المسموح به من وظائف Cron

### ملاحظات:
- تأكد من تعيين `CRON_API_KEY` بشكل صحيح في متغيرات البيئة على Vercel
- يجب أن تكون قيمة `CRON_API_KEY` قوية ومعقدة لأسباب أمنية
- يمكنك التحقق من سجلات التنفيذ في لوحة تحكم cron-job.org

### اختبار الوظائف:
يمكنك اختبار الوظائف يدويًا عن طريق تنفيذ الأمر التالي:

```bash
curl -i --location --request GET 'https://[project-name-on-vercel].vercel.app/api/cron/process-video-batch' \
--header 'Authorization: Bearer YOUR_CRON_API_KEY'
```
┌───────────────────────┬──────────────────┬──────────────────┐
│ Programming language  │ Files            │ Lines of code    │
├───────────────────────┼──────────────────┼──────────────────┤
│ Javascript            │ 99               │ 16719            │
├───────────────────────┼──────────────────┼──────────────────┤
│ Typescript            │ 4                │ 585              │
└───────────────────────┴──────────────────┴──────────────────┘
```
