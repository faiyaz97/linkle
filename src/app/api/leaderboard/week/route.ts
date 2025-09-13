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
    const weekIdParam = req.nextUrl.searchParams.get('week_id');
    if (!weekIdParam) return NextResponse.json({ error: 'week_id required' }, { status: 400 });
    const week_id = Number(weekIdParam);
    if (!Number.isFinite(week_id)) return NextResponse.json({ error: 'bad week_id' }, { status: 400 });

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const anon = sbAnon();
    const { data: auth } = token ? await anon.auth.getUser(token) : { data: { user: null } as any };
    const user = auth?.user ?? null;

    const admin = sbAdmin();

    const { data: wk, error: wkErr } = await admin
      .from('weeks')
      .select('id,start_date,end_date')
      .eq('id', week_id)
      .single();
    if (wkErr || !wk) return NextResponse.json({ error: 'week not found' }, { status: 404 });

    const { data: top, error: topErr } = await admin.rpc('week_top50', { p_week_id: week_id });
    if (topErr) return NextResponse.json({ error: topErr.message }, { status: 400 });

    let me = null as any;
    if (user) {
      const { data: mine } = await admin.rpc('week_rank_of', { p_week_id: week_id, p_user_id: user.id });
      me = Array.isArray(mine) ? (mine[0] ?? null) : mine ?? null; // <-- unwrap
    }

    return NextResponse.json({ week: wk, top: top ?? [], me });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
