// src/app/api/leaderboard/streak/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function sbAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const anon = sbAnon();
    const { data: auth } = token ? await anon.auth.getUser(token) : { data: { user: null } as any };
    const user = auth?.user ?? null;

    const admin = sbAdmin();

    // Top 50 by best streak, deterministic tie-break by created_at then id
    const { data: top, error: te } = await admin
      .from('users')
      .select('id,username,streak_best,created_at')
      .order('streak_best', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(50);

    if (te) return NextResponse.json({ error: te.message }, { status: 500 });

    const top50 = (top ?? []).map((u, i) => ({
      rank: i + 1,
      username: u.username ?? 'anon',
      value: Number(u.streak_best ?? 0),
      user_id: u.id as string,
    }));

    let me: { rank: number; username: string | null; value: number } | null = null;

    if (user) {
      const { data: meRow } = await admin
        .from('users')
        .select('username,streak_best')
        .eq('id', user.id)
        .maybeSingle();

      const myBest = Number(meRow?.streak_best ?? 0);

      // Rank = count of users with strictly greater best + 1 (ties share same rank)
      const { count } = await admin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gt('streak_best', myBest);

      me = {
        rank: (count ?? 0) + 1,
        username: meRow?.username ?? null,
        value: myBest,
      };
    }

    // Strip user_id before sending
    const sanitized = top50.map(({ user_id, ...rest }) => rest);

    return NextResponse.json({ top50: sanitized, me });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
