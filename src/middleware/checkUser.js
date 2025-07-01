import { supabaseAdmin } from '@/utils/supabase-server';

export async function ensureUserExists(session) {
  if (!session?.user?.auth_user_id) {
    throw new Error('No auth_user_id in session');
  }
  

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', session.user.auth_user_id)
    .single();

  if (!existingUser) {
    // User doesn't exist, create them
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: session.user.auth_user_id,
        email: session.user.email,
        name: session.user.name,
        avatar_url: session.user.image,
        google_id: session.user.id  // This is the sub/id from Google
      });

    if (insertError) {
      console.error('Error creating user:', insertError);
      throw new Error('Failed to create user');
    }
  }

  return true;
}
