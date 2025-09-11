// src/app/api/today/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { todayKey } from '@/lib/time';

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
    const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC';
    const { idx, date } = todayKey(tz);

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const anon = sbAnon();
    const { data: auth } = token ? await anon.auth.getUser(token) : { data: { user: null } as any };
    const user = auth?.user ?? null;

    const admin = sbAdmin();

    const { data: pub, error: pubErr } = await admin
      .from('puzzles_public')
      .select('idx,puzzle_date,clues')
      .eq('idx', idx)
      .single();
    if (pubErr || !pub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const clues = Array.isArray(pub.clues)
      ? (pub.clues as string[])
      : typeof pub.clues === 'string'
      ? JSON.parse(pub.clues as string)
      : [];

    let submission: any = null;
    let answer: string | undefined;

    if (user) {
      const { data: sub } = await admin
        .from('submissions')
        .select('lives_left,solved,points,guesses')
        .eq('user_id', user.id)
        .eq('puzzle_idx', idx)
        .maybeSingle();

      if (sub) {
        submission = {
          lives_left: sub.lives_left,
          solved: sub.solved,
          points: sub.points,
          guesses: Array.isArray(sub.guesses) ? (sub.guesses as string[]) : [],
        };

        if (sub.solved) {
          const arr = Array.isArray(sub.guesses) ? (sub.guesses as string[]) : [];
          answer = arr.at(-1);
        } else if (sub.lives_left === 0) {
          const { data: sec } = await admin.from('puzzles_secret').select('target_word').eq('idx', idx).single();
          if (sec?.target_word) answer = String(sec.target_word);
        }
      }
    }

    return NextResponse.json({
      idx: pub.idx,
      puzzle_date: pub.puzzle_date,
      local_date: date,
      clues,
      submission,
      answer,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
