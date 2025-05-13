# نصوص وظائف Supabase Edge Functions

هذا الملف يحتوي على شيفرات وظائف Edge Functions لنسخها ولصقها في Supabase Dashboard.

## وظيفة process-videos

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// التحقق من مفتاح API
const validateApiSecret = (authHeader: string) => {
  const apiKey = Deno.env.get("CRON_API_KEY");
  if (!apiKey) return false;
  
  const token = authHeader?.split(" ")[1];
  return token === apiKey;
};

serve(async (req) => {
  // التعامل مع طلب OPTIONS مع إضافة CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // التحقق من المصادقة
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !validateApiSecret(authHeader)) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // استخراج معلمات من الطلب
    const requestData = await req.json();
    const { batchSize = 8, userEmail } = requestData;

    // بناء استعلام لجلب الفيديوهات المعلقة
    let query = supabase
      .from("video_queue")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(batchSize);

    // إضافة شرط البريد الإلكتروني للمستخدم إذا كان محددًا
    if (userEmail) {
      query = query.eq("user_email", userEmail);
    }

    // تنفيذ الاستعلام لجلب الفيديوهات المعلقة
    const { data: pendingVideos, error } = await query;

    if (error) {
      throw new Error(`خطأ في جلب الفيديوهات المعلقة: ${error.message}`);
    }

    if (!pendingVideos || pendingVideos.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "لا توجد فيديوهات معلقة للمعالجة", 
          videos_processed: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // تحديث حالة الفيديوهات إلى "processing"
    const videoIds = pendingVideos.map(video => video.id);
    const { error: updateError } = await supabase
      .from("video_queue")
      .update({ 
        status: "processing",
        processing_started_at: new Date().toISOString()
      })
      .in("id", videoIds);

    if (updateError) {
      throw new Error(`خطأ في تحديث حالة الفيديوهات: ${updateError.message}`);
    }

    // تحديث إحصائيات المعالجة
    const now = new Date().toISOString();
    const { error: statsError } = await supabase
      .from("processing_stats")
      .upsert([
        {
          id: "daily_stats",
          videos_processing: pendingVideos.length,
          last_batch_started: now,
          updated_at: now
        }
      ], { onConflict: "id" });

    if (statsError) {
      console.error("خطأ في تحديث إحصائيات المعالجة:", statsError);
    }

    // معالجة كل فيديو بالتوازي
    const apiUrl = Deno.env.get("API_URL") || "http://localhost:3000";
    const processingResults = await Promise.all(
      pendingVideos.map(async (video) => {
        try {
          const response = await fetch(`${apiUrl}/api/process-single-video`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("CRON_API_KEY")}`,
            },
            body: JSON.stringify({ videoId: video.id }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "فشل في معالجة الفيديو");
          }

          return {
            videoId: video.id,
            status: "processing",
            success: true,
          };
        } catch (error) {
          // تحديث حالة الفيديو إلى خطأ في حالة الفشل
          await supabase
            .from("video_queue")
            .update({ 
              status: "error",
              error_message: error.message || "فشل في معالجة الفيديو"
            })
            .eq("id", video.id);

          return {
            videoId: video.id,
            status: "error",
            error: error.message || "فشل في معالجة الفيديو",
            success: false,
          };
        }
      })
    );

    return new Response(
      JSON.stringify({
        message: `تمت إضافة ${pendingVideos.length} فيديو(هات) إلى المعالجة`,
        videos_processed: pendingVideos.length,
        results: processingResults,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("خطأ في معالجة الفيديوهات:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message || "حدث خطأ أثناء معالجة الفيديوهات",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
```

## وظيفة process-single-video

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// التحقق من مفتاح API
const validateApiSecret = (authHeader: string) => {
  const apiKey = Deno.env.get("CRON_API_KEY");
  if (!apiKey) return false;
  
  const token = authHeader?.split(" ")[1];
  return token === apiKey;
};

serve(async (req) => {
  // التعامل مع طلب OPTIONS مع إضافة CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // التحقق من المصادقة
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !validateApiSecret(authHeader)) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // استخراج معرف الفيديو من الطلب
    const requestData = await req.json();
    const videoId = requestData.videoId;

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "معرف الفيديو مطلوب" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // جلب معلومات الفيديو من قاعدة البيانات
    const { data: video, error: videoError } = await supabase
      .from("video_queue")
      .select("*")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ 
          error: videoError?.message || "الفيديو غير موجود" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // التأكد من أن الفيديو في حالة معالجة
    if (video.status !== "processing") {
      // تحديث حالة الفيديو إلى معالجة إذا لم يكن كذلك بالفعل
      await supabase
        .from("video_queue")
        .update({ 
          status: "processing",
          processing_started_at: new Date().toISOString()
        })
        .eq("id", videoId);
    }

    // استدعاء API لمعالجة الفيديو
    const apiUrl = Deno.env.get("API_URL") || "http://localhost:3000";
    const processingResponse = await fetch(`${apiUrl}/api/videos/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CRON_API_KEY")}`,
      },
      body: JSON.stringify({ 
        videoId: video.video_id,
        queueId: video.id,
        userId: video.user_id,
        sourceUrl: video.source_url,
        title: video.title,
        description: video.description,
        tags: video.tags,
        privacy: video.privacy || "unlisted"
      }),
    });

    if (!processingResponse.ok) {
      const errorData = await processingResponse.json();
      throw new Error(errorData.error || "فشل في معالجة الفيديو");
    }

    const result = await processingResponse.json();

    // تحديث حالة الفيديو إلى مكتمل
    await supabase
      .from("video_queue")
      .update({ 
        status: "completed",
        processed_at: new Date().toISOString(),
        youtube_video_id: result.youtubeVideoId || null,
        result_data: result
      })
      .eq("id", videoId);

    // تحديث إحصائيات المعالجة
    const { data: stats } = await supabase
      .from("processing_stats")
      .select("*")
      .eq("id", "daily_stats")
      .single();

    if (stats) {
      const updatedStats = {
        videos_processing: Math.max(0, (stats.videos_processing || 0) - 1),
        videos_processed_today: (stats.videos_processed_today || 0) + 1,
        total_videos_processed: (stats.total_videos_processed || 0) + 1,
        updated_at: new Date().toISOString()
      };

      await supabase
        .from("processing_stats")
        .update(updatedStats)
        .eq("id", "daily_stats");
    }

    return new Response(
      JSON.stringify({
        message: "تمت معالجة الفيديو بنجاح",
        success: true,
        video: {
          id: video.id,
          title: video.title,
          status: "completed",
          youtubeVideoId: result.youtubeVideoId || null
        },
        result
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("خطأ في معالجة الفيديو:", error);
    
    // تحديث حالة الفيديو إلى خطأ في حالة الفشل (إذا تم توفير معرف الفيديو)
    try {
      const requestData = await req.json();
      const videoId = requestData.videoId;
      
      if (videoId) {
        await supabase
          .from("video_queue")
          .update({ 
            status: "error",
            error_message: error.message || "فشل في معالجة الفيديو"
          })
          .eq("id", videoId);
      }
    } catch (updateError) {
      console.error("خطأ في تحديث حالة الفيديو:", updateError);
    }
    
    return new Response(
      JSON.stringify({
        error: error.message || "حدث خطأ أثناء معالجة الفيديو",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
```

## وظيفة process-cron

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// التحقق من مفتاح API
const validateApiSecret = (authHeader: string) => {
  const apiKey = Deno.env.get("CRON_API_KEY");
  if (!apiKey) return false;
  
  const token = authHeader?.split(" ")[1];
  return token === apiKey;
};

serve(async (req) => {
  // التعامل مع طلب OPTIONS مع إضافة CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // التحقق من المصادقة
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !validateApiSecret(authHeader)) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // استخراج معلمات من الطلب (تحقق ما إذا كان إعادة تعيين الإحصائيات)
    let resetStats = false;
    try {
      const requestData = await req.json();
      resetStats = requestData.reset_stats === true;
    } catch (e) {
      // لا تفعل شيئًا إذا لم يكن الطلب به json
    }

    // إذا كان إعادة تعيين الإحصائيات، قم بذلك وارجع
    if (resetStats) {
      const now = new Date().toISOString();
      const { error: statsError } = await supabase
        .from("processing_stats")
        .update({
          videos_processed_today: 0,
          videos_processing: 0,
          last_daily_reset: now,
          updated_at: now
        })
        .eq("id", "daily_stats");

      if (statsError) {
        throw new Error(`خطأ في إعادة تعيين الإحصائيات: ${statsError.message}`);
      }

      return new Response(
        JSON.stringify({ 
          message: "تم إعادة تعيين الإحصائيات اليومية بنجاح" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // الحصول على عدد الفيديوهات التي في قيد المعالجة بالفعل
    const { data: stats } = await supabase
      .from("processing_stats")
      .select("videos_processing")
      .eq("id", "daily_stats")
      .single();

    const currentlyProcessing = stats?.videos_processing || 0;
    
    // لا تبدأ دفعة جديدة إذا كان هناك العديد من الفيديوهات قيد المعالجة بالفعل
    if (currentlyProcessing >= 8) {
      return new Response(
        JSON.stringify({ 
          message: `الانتظار حتى تكتمل الدفعة الحالية (${currentlyProcessing} فيديو قيد المعالجة)` 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // استدعاء وظيفة process-videos لبدء معالجة دفعة جديدة
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const response = await fetch(`${supabaseUrl}/functions/v1/process-videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CRON_API_KEY")}`,
      },
      body: JSON.stringify({ batchSize: 8 }),
    });

    if (!response.ok) { 
      const errorData = await response.json();
      throw new Error(errorData.error || "فشل في بدء معالجة الفيديو");
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        message: `تمت جدولة ${result.videos_processed} فيديو(هات) للمعالجة`,
        videos_scheduled: result.videos_processed,
        result
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("خطأ في وظيفة process-cron:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message || "حدث خطأ أثناء تنفيذ وظيفة cron",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
``` 