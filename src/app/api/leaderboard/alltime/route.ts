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

    const { data: top, error: topErr } = await admin.rpc('alltime_top50');
    if (topErr) return NextResponse.json({ error: topErr.message }, { status: 400 });

    let me = null as any;
    if (user) {
      const { data: mine } = await admin.rpc('alltime_rank_of', { p_user_id: user.id });
      me = Array.isArray(mine) ? (mine[0] ?? null) : mine ?? null; // <-- unwrap
    }

    return NextResponse.json({ top: top ?? [], me });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
