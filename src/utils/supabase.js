import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with public environment variables
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize a client with the service role key for server-side operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Function to save user data after sign-in
export async function saveUserToSupabase(user) {
  if (!user || !user.email) return null;
  
  try {
    // First, check if user exists in Supabase Auth
    const { data, error: getUserError } = await supabaseAdmin.auth.admin.listUsers({
      filter: {
        term: user.email
      }
    });
    
    const existingAuthUser = data?.users?.find(u => u.email === user.email);
    let userId = existingAuthUser?.id;
    
    // If not found, create a user in Supabase Auth
    if (!userId) {
      const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          full_name: user.name,
          avatar_url: user.image
        }
      });
      
      if (createUserError) {
        console.error('Error creating user in Supabase Auth:', createUserError);
        return null;
      }
      
      console.log('Created user in Supabase Auth:', createUserData?.user?.id);
      userId = createUserData?.user?.id;
    }
    
    // Now handle the user in the 'users' table
    try {
      // Check if user already exists in the users table
      // Use email as the primary key instead of id
      const { data: existingDbUser, error } = await supabaseAdmin
        .from('users')
        .select('email, name')  // Select specific columns to avoid 'id' column
        .eq('email', user.email)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Not found error is OK
        throw error;
      }
      
      if (existingDbUser) {
        // Update existing user with only essential fields
        const { data, error } = await supabaseAdmin
          .from('users')
          .update({
            name: user.name
          })
          .eq('email', user.email)
          .select('email, name')
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new user with only essential fields
        const { data, error } = await supabaseAdmin
          .from('users')
          .insert({
            email: user.email,
            name: user.name
          })
          .select('email, name')
          .single();
        
        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error saving user to Supabase:', error);
      return null;
    }
  } catch (error) {
    console.error('Error in user auth check:', error);
    return null;
  }
}

// Function to save user tokens for background access
export async function saveUserTokens({ email, accessToken, refreshToken, expiresAt }) {
  try {
    if (!email || !accessToken) {
      console.error('Missing required parameters for saveUserTokens');
      return null;
    }

    console.log(`Saving tokens for ${email}`);
    
    // Check if tokens already exist for this user
    const { data: existingTokens, error: queryError } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_email', email) // Using user_email for consistency
      .single();
    
    if (queryError && queryError.code !== 'PGRST116') {
      throw queryError;
    }
    
    const updateData = {
      access_token: accessToken,
      updated_at: new Date().toISOString()
    };
    
    // Only include refresh token if provided
    if (refreshToken) {
      updateData.refresh_token = refreshToken;
    }
    
    // Include expiry time if provided
    if (expiresAt) {
      // Ensure expiresAt is stored as a number (Unix timestamp in seconds)
      if (typeof expiresAt === 'number') {
        updateData.expires_at = expiresAt; 
      } else if (typeof expiresAt === 'string' && !isNaN(Number(expiresAt))) {
        // Convert string to number if it's a valid number
        updateData.expires_at = Number(expiresAt);
      } else if (expiresAt instanceof Date) {
        // Convert Date to Unix timestamp
        updateData.expires_at = Math.floor(expiresAt.getTime() / 1000);
      } else {
        // Default: use current time + 1 hour
        updateData.expires_at = Math.floor(Date.now() / 1000) + 3600;
        console.warn(`Invalid expiresAt format: ${expiresAt}, using fallback expiry time`);
      }
    }
    
    if (existingTokens) {
      // Update existing tokens
      const { data, error } = await supabaseAdmin
        .from('user_tokens')
        .update(updateData)
        .eq('user_email', email)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating tokens:', error);
        // Try again without any problematic fields that might be missing from the schema
        const basicUpdateData = {
          access_token: accessToken,
          refresh_token: refreshToken,
          updated_at: new Date().toISOString()
        };
        
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('user_tokens')
          .update(basicUpdateData)
          .eq('user_email', email);
          
        if (retryError) throw retryError;
        return retryData;
      }
      
      console.log(`Updated tokens for ${email}`);
      return data;
    } else {
      // Insert new tokens
      updateData.user_email = email; // Add email for new records
      
      const { data, error } = await supabaseAdmin
        .from('user_tokens')
        .insert(updateData)
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting tokens:', error);
        // Try again with only essential fields
        const basicInsertData = {
          user_email: email,
          access_token: accessToken,
          refresh_token: refreshToken,
          updated_at: new Date().toISOString()
        };
        
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('user_tokens')
          .insert(basicInsertData);
          
        if (retryError) throw retryError;
        return retryData;
      }
      
      console.log(`Inserted new tokens for ${email}`);
      return data;
    }
  } catch (error) {
    console.error('Error saving user tokens to Supabase:', error);
    return null;
  }
}

// Function to save TikTok video data to Supabase
export async function saveTikTokVideoData(email, videoData) {
  try {
    // Extract hashtags from the description
    const hashtags = (videoData.description || '').match(/#[a-zA-Z0-9_]+/g) || [];
    
    // Insert video data
    const { data, error } = await supabaseAdmin
      .from('tiktok_videos')
      .insert({
        user_email: email,
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