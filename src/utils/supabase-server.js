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

    // Use upsert to handle both insert and update in one operation
    const { data: savedUser, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          email: user.email,
          name: user.name,
          avatar_url: user.image,
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'email',
          returning: 'representation'
        }
      )
      .select('*')
      .single();

    if (upsertError) {
      throw upsertError;
    }

    if (!savedUser) {
      throw new Error('No user data returned after save');
    }

    // Ensure user has at least one account
    const { data: existingAccount } = await supabaseAdmin
      .from('user_accounts')
      .select('*')
      .eq('user_id', savedUser.id)
      .maybeSingle();

    if (!existingAccount) {
      // Create default account if none exists
      const { data: newAccount, error: accountError } = await supabaseAdmin
        .from('user_accounts')
        .insert({
          user_id: savedUser.id,
          email: user.email,  // Add the email field here
          name: 'Default Account',
          is_active: true
        })
        .select()
        .single();

      if (accountError) {
        throw accountError;
      }

      // Update user with the new active account
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ active_account_id: newAccount.id })
        .eq('id', savedUser.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return updatedUser;
    }

    return savedUser;
  } catch (error) {
    console.error('saveUserToSupabase error:', error);
    throw error;
  }
}

// Function to save user tokens for background access
export async function saveUserTokens({ email, accessToken, refreshToken, expiresAt }) {
  try {
    if (!email || !accessToken) {
      console.error('saveUserTokens: Missing required parameters');
      return null;
    }

    console.log('saveUserTokens: Starting token save for:', email);

    // Get user data with auth and account info
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, active_account_id')
      .eq('email', email)
      .single();

    if (userError) {
      console.error('saveUserTokens: Error finding user:', userError);
      return null;
    }

    if (!userData.id || !userData.active_account_id) {
      console.error('saveUserTokens: User or account not properly initialized:', userData);
      return null;
    }

    // Calculate expiration time
    let calculatedExpiresAt;
    if (typeof expiresAt === 'number') {
      calculatedExpiresAt = expiresAt;
    } else if (typeof expiresAt === 'string' && !isNaN(Number(expiresAt))) {
      calculatedExpiresAt = Number(expiresAt);
    } else if (expiresAt instanceof Date) {
      calculatedExpiresAt = Math.floor(expiresAt.getTime() / 1000);
    } else {
      calculatedExpiresAt = Math.floor(Date.now() / 1000) + 3600;
    }

    // Prepare token data
    const tokenData = {
      auth_user_id: userData.id,
      account_id: userData.active_account_id,
      user_email: email,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: calculatedExpiresAt,
      is_valid: true,
      error_message: null,
      updated_at: new Date().toISOString()
    };

    // Try to update existing tokens first
    const { data: updatedToken, error: updateError } = await supabaseAdmin
      .from('user_tokens')
      .update(tokenData)
      .eq('user_email', email)
      .select()
      .single();

    if (!updateError && updatedToken) {
      console.log('saveUserTokens: Tokens updated successfully for:', email);
      return updatedToken;
    }

    // If update failed because tokens don't exist, create new ones
    if (updateError && updateError.code === 'PGRST116') {
      const { data: newToken, error: insertError } = await supabaseAdmin
        .from('user_tokens')
        .insert({
          ...tokenData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('saveUserTokens: Error creating tokens:', insertError);
        return null;
      }

      console.log('saveUserTokens: New tokens created successfully for:', email);
      return newToken;
    }

    // If we got here, something unexpected happened
    console.error('saveUserTokens: Unexpected error:', updateError);
    return null;
  } catch (error) {
    console.error('Error saving user tokens to Supabase:', error);
    return null;
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