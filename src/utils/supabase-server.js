import { createClient } from '@supabase/supabase-js';

// إنشاء عميل Supabase للخادم
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// التحقق من وجود المفاتيح المطلوبة - فقط في بيئة الخادم
if (typeof window === 'undefined' && (!supabaseUrl || !supabaseServiceKey)) {
  console.error('Supabase URL or Service Role Key is missing. Please check your environment variables.');
}

// إنشاء عميل Supabase للخادم مع إضافة إعدادات timeout وretry
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: async (url, options = {}) => {
        // Add timeout to prevent hanging connections
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        // Implement basic retry logic
        let retries = 3;
        let lastError = null;
        
        while (retries > 0) {
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
          } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
              console.log(`Retrying Supabase request, ${retries} attempts left`);
            }
          }
        }
        
        clearTimeout(timeoutId);
        console.error('All Supabase request attempts failed:', lastError);
        throw lastError;
      }
    }
  }
);

// Function to save user data after sign-in
export async function saveUserToSupabase(user) {
  if (!user?.email) {
    throw new Error('saveUserToSupabase: User email is required');
  }

  try {
    console.log('saveUserToSupabase: Processing user:', user.email);

    // Start a transaction to ensure data consistency
    // REMOVING the call to the problematic RPC
    // const { data: result, error: transactionError } = await supabaseAdmin.rpc('handle_user_registration', {
    //   p_email: user.email,
    //   p_name: user.name,
    //   p_avatar_url: user.image
    // });

    // if (transactionError) {
    //   console.error('Transaction error in handle_user_registration:', transactionError);
    //   throw transactionError;
    // }

    // ADDING direct INSERT/UPDATE logic for public.users table
    console.log('Attempting upsert for user:', { email: user.email, name: user.name });
    
    const { data: userData, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert({
        email: user.email,
        name: user.name,
        avatar_url: user.image,
        // Assuming 'role' has a default value in the table definition,
        // or you might need to add it here if it's mandatory and not nullable.
        // created_at and updated_at are likely handled by Supabase defaults/triggers
      }, { onConflict: 'email' }) // Conflict resolution based on email
      .select('*') // Select the inserted/updated row
      .single(); // Expecting a single result

    console.log('Upsert result:', { userData, upsertError });

    if (upsertError) {
      console.error('Error upserting user data:', upsertError);
      throw upsertError;
    }

    console.log('saveUserToSupabase: User data upserted successfully:', userData.id);

    // Double-check the user exists immediately after upsert
    const { data: doubleCheck, error: doubleCheckError } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('id', userData.id)
      .single();

    console.log('Double-check result:', { doubleCheck, doubleCheckError });

    if (doubleCheckError || !doubleCheck) {
      console.error('CRITICAL: User not found immediately after upsert!', doubleCheckError);
      throw new Error(`User verification failed immediately after upsert: ${doubleCheckError?.message}`);
    }

    // Return the userData directly from upsert instead of fetching again
    // This avoids potential timing issues with foreign key constraints
    return userData;
  } catch (error) {
    console.error('saveUserToSupabase error:', error);
    throw error; // Re-throw the error to be caught by the caller (NextAuth callback)
  }
}

// Function to save user tokens for background access
// Now accepts authUserId and accountId directly
export async function saveUserTokens({ authUserId, accountId, email, accessToken, refreshToken, expiresAt }) {
  try {
    // Check for required parameters: authUserId and accountId are now mandatory
    if (!authUserId || !accountId || !accessToken) {
      console.error('saveUserTokens: Missing required parameters (authUserId, accountId, accessToken)');
      return null;
    }

    console.log(`saveUserTokens: Upserting token for User ID: ${authUserId}, Account ID: ${accountId}`);

    // Calculate expiration time as a Unix timestamp (seconds)
    const calculatedExpiresAt = expiresAt && typeof expiresAt === 'number'
      ? Math.floor(expiresAt)
      : Math.floor(Date.now() / 1000) + 3600; // Default to 1 hour

    // Prepare token data for upsert
    const tokenData = {
      auth_user_id: authUserId,
      account_id: accountId,
      user_email: email, // Keep for reference
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: calculatedExpiresAt,
      is_valid: true, // Assume token is valid on save
      error_message: null,
      last_network_error: null,
    };

    // Use `upsert` to either insert a new token or update an existing one.
    // We define the conflict constraint on `auth_user_id` and `account_id`.
    // This means a unique token record exists for each combination of a user and their linked account.
    const { data: upsertedToken, error: upsertError } = await supabaseAdmin
      .from('user_tokens')
      .upsert(tokenData, {
        onConflict: 'auth_user_id,account_id', // IMPORTANT: Specify the columns that define a unique token
        ignoreDuplicates: false, // Ensure it updates on conflict
      })
      .select()
      .single();

    if (upsertError) {
      console.error('saveUserTokens: Error upserting tokens:', upsertError);
      // Check if the error is due to a missing unique constraint
      if (upsertError.message.includes('constraint')) {
         console.error('DATABASE SETUP ERROR: Please ensure a UNIQUE constraint exists on (auth_user_id, account_id) in the user_tokens table.');
      }
      throw upsertError; // Throw error to be caught by the caller
    }

    console.log(`saveUserTokens: Token upserted successfully for Account ID ${accountId}.`);
    return upsertedToken;

  } catch (error) {
    console.error('Error saving user tokens to Supabase:', error);
    // Re-throw the error so the caller can handle it
    throw error;
  }
}

// Function to save TikTok video data to Supabase
export async function saveTikTokVideoData(authUserId, accountId, videoData) {
  try {
    // Extract hashtags from the description
    const hashtags = (videoData.description || '').match(/#[a-zA-Z0-9_]+/g) || [];
    
    // Insert video data with account information
    const { data, error } = await supabaseAdmin
      .from('tiktok_videos')
      .insert({
        auth_user_id: authUserId,
        account_id: accountId,
        video_id: videoData.videoId,
        title: videoData.title,
        description: videoData.description,
        hashtags: hashtags,
        original_url: videoData.originalUrl,
        download_url: videoData.downloadUrl,
        drive_folder_id: videoData.driveFolderId,
        drive_file_id: videoData.driveFileId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving TikTok video data to Supabase:', error);
    return null;
  }
}