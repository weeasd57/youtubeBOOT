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
      filters: {
        email: user.email
      }
    });
    
    // If user doesn't exist in Auth, create them
    if ((!data || data.users.length === 0) && !getUserError) {
      // Generate a random secure password since they'll use OAuth
      const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      
      // Create user in Auth system
      const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          avatar_url: user.image
        }
      });
      
      if (createUserError) {
        console.error('Error creating user in Supabase Auth:', createUserError);
      } else {
        console.log('Created user in Supabase Auth:', createUserData?.user?.id);
      }
    }
    
    // Now handle the user in the 'users' table
    // Check if user already exists in the users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();
    
    if (existingUser) {
      // Update existing user
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({
          name: user.name,
          image: user.image,
          last_sign_in: new Date().toISOString(),
        })
        .eq('email', user.email)
        .select();
      
      if (error) throw error;
      return data;
    } else {
      // Insert new user
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({
          email: user.email,
          name: user.name,
          image: user.image,
          created_at: new Date().toISOString(),
          last_sign_in: new Date().toISOString(),
        })
        .select();
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error saving user to Supabase:', error);
    return null;
  }
}

// Function to save user tokens for background access
export async function saveUserTokens({ email, accessToken, refreshToken, expiresAt }) {
  if (!email || !accessToken) return null;

  try {
    // Check if user tokens already exist
    const { data: existingTokens } = await supabaseAdmin
      .from('user_tokens')
      .select('*')
      .eq('user_email', email)
      .single();
    
    if (existingTokens) {
      // Update existing tokens
      const { data, error } = await supabaseAdmin
        .from('user_tokens')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken || existingTokens.refresh_token,
          expires_at: expiresAt || existingTokens.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', email)
        .select();
      
      if (error) throw error;
      return data;
    } else {
      // Insert new tokens
      const { data, error } = await supabaseAdmin
        .from('user_tokens')
        .insert({
          user_email: email,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error saving user tokens to Supabase:', error);
    return null;
  }
} 