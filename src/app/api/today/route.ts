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

function ensureAnonCookie() {
  const jar = cookies();
  let anon = jar.get('anon_id')?.value;
  if (!anon) {
    anon = 'guest-' + crypto.randomUUID();
    const res = NextResponse.json({});
    res.cookies.set('anon_id', anon, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return { anon, cookieResponse: res };
  }
  return { anon, cookieResponse: null as NextResponse | null };
}

export async function GET(req: NextRequest) {
  try {
    const tz = req.nextUrl.searchParams.get('tz') ?? 'UTC';
    const { idx, date } = todayKey(tz);

    const { anon, cookieResponse } = ensureAnonCookie();
    const sb = sbAdmin();

    const { data: pub, error } = await sb
      .from('puzzles_public')
      .select('idx, puzzle_date, clues')
      .eq('idx', idx)
      .single();

    if (error || !pub) {
      const payload = { error: error?.message ?? 'Not found', idx };
      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { status: 404, headers: cookieResponse.headers })
        : NextResponse.json(payload, { status: 404 });
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
      .eq('anon_id', anon)
      .maybeSingle();

    let firstLetter: string | undefined;
    let wordHint: string | undefined;

    if (sub && !sub.solved && sub.lives_left <= 2) {
      const { data: sec } = await sb
        .from('puzzles_secret')
        .select('target_word, word_hint')
        .eq('idx', idx)
        .single();
      if (sec) {
        if (sub.lives_left <= 2) firstLetter = sec.target_word?.[0];
        if (sub.lives_left <= 1) wordHint = sec.word_hint;
      }
    }

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
      hints: { firstLetter, wordHint },
    };

    return cookieResponse
      ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
      : NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
