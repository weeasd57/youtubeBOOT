import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic rendering so stats are fresh per-request
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 * Returns aggregated dashboard metrics for the signed-in user.
 * If the request is unauthenticated a 401 response is returned.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Not signed in –> 401
    if (!session?.user?.auth_user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUserId = session.user.auth_user_id;

    // Calculate today range (UTC)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    /*
      Use head:true so we only receive the row-count back – keeps payload tiny.
      If any query fails we default that metric to 0 rather than blowing up the request.
    */
    const [scheduledRes, publishedRes, accountsRes, pendingRes] = await Promise.all([
      supabaseAdmin
        .from('scheduled_uploads')
        .select('id', { head: true, count: 'exact' })
        .eq('auth_user_id', authUserId),

      supabaseAdmin
        .from('uploads')
        .select('id', { head: true, count: 'exact' })
        .eq('auth_user_id', authUserId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString()),

      supabaseAdmin
        .from('accounts')
        .select('id', { head: true, count: 'exact' })
        .eq('owner_id', authUserId),

      supabaseAdmin
        .from('uploads')
        .select('id', { head: true, count: 'exact' })
        .eq('auth_user_id', authUserId)
        .eq('status', 'pending')
    ]);

    // Helper to safely extract count value (Supabase v2 returns count or null)
    const safeCount = (q) => (q?.error ? 0 : q?.count ?? 0);

    return NextResponse.json({
      scheduled_posts: safeCount(scheduledRes),
      published_today: safeCount(publishedRes),
      total_accounts: safeCount(accountsRes),
      pending_approval: safeCount(pendingRes)
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}