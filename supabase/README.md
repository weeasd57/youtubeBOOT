# وظائف Supabase Edge لمعالجة الفيديو

هذا المجلد يحتوي على وظائف Edge Functions لمعالجة الفيديو في Supabase. هذه الوظائف تُستخدم لتنفيذ عمليات معالجة الفيديو دفعةً واحدة ومعالجة الفيديوهات فرديًا.

## المتطلبات

- حساب Supabase
- Supabase CLI
- أن تكون متصلًا بمشروع Supabase
- مفتاح API للتشغيل الآلي (CRON_API_KEY)

## الوظائف المتوفرة

1. **process-videos** - وظيفة لمعالجة دفعة من الفيديوهات (بحد أقصى 8 في المرة الواحدة)
2. **process-single-video** - وظيفة لمعالجة فيديو واحد
3. **process-cron** - وظيفة تُشغل بواسطة Cron لتشغيل معالجة الفيديو دوريًا

## إعداد المتغيرات البيئية

1. انسخ ملف `.env.example` إلى ملف جديد باسم `.env`:
```
cp .env.example .env
```

2. قم بتحرير الملف وتعبئة القيم المطلوبة:
```
CRON_API_KEY=<مفتاح آمن للتشغيل الآلي>
API_URL="http://127.0.0.1"
PROJECT_REF=<مرجع مشروع Supabase>
GOOGLE_CLIENT_ID=<معرف عميل Google>
GOOGLE_CLIENT_SECRET=<سر عميل Google>
GOOGLE_REDIRECT_URI=<عنوان إعادة التوجيه>
```

## نشر الوظائف

1. تأكد من تثبيت Supabase CLI وتسجيل الدخول:
```
supabase login
```

2. نشر وظائف Edge:
```
supabase functions deploy process-videos --project-ref <مرجع مشروع Supabase>
supabase functions deploy process-single-video --project-ref <مرجع مشروع Supabase>
supabase functions deploy process-cron --project-ref <مرجع مشروع Supabase>
```

3. تعيين المتغيرات البيئية:
```
supabase secrets set --env-file .env --project-ref <مرجع مشروع Supabase>
```

## إعداد وظيفة Cron

يتضمن المشروع وظيفة Cron من خلال ملف `crontab` الذي يُشغل وظيفة `process-cron` كل 10 دقائق.

1. تحقق من ملف crontab:
```
cat crontab
```

2. عدّل هذا الملف حسب احتياجاتك، ثم قم بتفعيل Cron Jobs:
```
supabase functions schedule --cron-file ./crontab --project-ref <مرجع مشروع Supabase>
```

## اختبار الوظائف

يمكنك اختبار الوظائف عن طريق استدعائها مباشرة باستخدام curl:

```bash
# معالجة دفعة من الفيديوهات
curl -i --location --request POST 'https://<PROJECT_REF>.supabase.co/functions/v1/process-videos' \
--header 'Authorization: Bearer <CRON_API_KEY>' \
--header 'Content-Type: application/json' \
--data-raw '{}'

# معالجة فيديو واحد
curl -i --location --request POST 'https://<PROJECT_REF>.supabase.co/functions/v1/process-single-video' \
--header 'Authorization: Bearer <CRON_API_KEY>' \
--header 'Content-Type: application/json' \
--data-raw '{"videoId": "<معرف الفيديو>"}'

# تشغيل وظيفة Cron يدويًا
curl -i --location --request POST 'https://<PROJECT_REF>.supabase.co/functions/v1/process-cron' \
--header 'Authorization: Bearer <CRON_API_KEY>'
```

## مزيد من المعلومات

- [وثائق Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [تكوين Cron Jobs في Supabase](https://supabase.com/docs/guides/functions/schedule-functions) 