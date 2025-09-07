// src/app/api/today/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { todayKey } from '@/lib/time';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';

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
    const { idx, date } = todayKey(tz);

    // Anon cookie (no intermediate response merging)
    const jar = cookies();
    let anon = jar.get('anon_id')?.value;
    const needCookie = !anon;
    if (!anon) anon = 'guest-' + crypto.randomUUID();

    const sb = sbAdmin();

    const { data: pub, error: pubErr } = await sb
      .from('puzzles_public')
      .select('idx, puzzle_date, clues')
      .eq('idx', idx)
      .single();

    if (pubErr || !pub) {
      const res = NextResponse.json({ error: pubErr?.message ?? 'Not found', idx }, { status: 404 });
      if (needCookie) {
        res.cookies.set('anon_id', anon!, {
          httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 365, path: '/',
        });
      }
      return res;
    }

    const clues = Array.isArray(pub.clues)
      ? (pub.clues as string[])
      : typeof pub.clues === 'string'
      ? JSON.parse(pub.clues as unknown as string)
      : [];

    const { data: sub } = await sb
      .from('submissions')
      .select('lives_left, solved, points, guesses')
      .eq('puzzle_idx', idx)
      .eq('anon_id', anon!)
      .maybeSingle();

    const payload = {
      idx: pub.idx,
      puzzle_date: pub.puzzle_date,
      local_date: date,
      clues,
      submission: sub
        ? {
            lives_left: sub.lives_left,
            solved: sub.solved,
            points: sub.points,
            guesses: Array.isArray(sub.guesses) ? (sub.guesses as string[]) : [],
          }
        : null,
    };

    const res = NextResponse.json(payload, { status: 200 });
    if (needCookie) {
      res.cookies.set('anon_id', anon!, {
        httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 365, path: '/',
      });
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
