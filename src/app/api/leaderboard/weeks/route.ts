// src/app/api/leaderboard/weeks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

export const runtime = 'nodejs';

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC';
    const isoDate = DateTime.now().setZone(tz).toISODate(); // 'YYYY-MM-DD'

    const admin = sbAdmin();

    // Ensure current week exists and get its id
    const { data: cur, error: curErr } = await admin.rpc('ensure_week_for_date', { d: isoDate as any });
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 400 });
    const current_week_id = (cur as unknown as number) ?? null;

    // Fetch recent weeks
    const { data: weeks, error } = await admin
      .from('weeks')
      .select('id,start_date,end_date')
      .order('start_date', { ascending: false })
      .limit(26);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Sequence numbers
    const asc = [...(weeks ?? [])].sort((a: any, b: any) =>
      a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0
    );
    const seqMap = new Map<number, number>();
    asc.forEach((w: any, i: number) => seqMap.set(w.id, i + 1));

    const out = (weeks ?? []).map((w: any) => ({
      id: w.id,
      start_date: w.start_date,
      end_date: w.end_date,
      seq: seqMap.get(w.id) ?? null,
    }));

    return NextResponse.json({ current_week_id, weeks: out });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
