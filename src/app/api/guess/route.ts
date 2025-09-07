import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { msSinceLocalMidnight } from '@/lib/time';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const runtime = 'nodejs';

const Body = z.object({ idx: z.number(), guess: z.string().min(1), tz: z.string() });

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function jsonWithCookies(payload: any, cookieResponse: NextResponse | null) {
  return cookieResponse
    ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
    : NextResponse.json(payload);
}

function ensureAnon(): { anon: string; cookieResponse: NextResponse | null } {
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
  return { anon, cookieResponse: null };
}

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const { anon, cookieResponse } = ensureAnon();
    const sb = sbAdmin();

    const { data: secret, error: se } = await sb
      .from('puzzles_secret')
      .select('target_word,word_hint')
      .eq('idx', body.idx)
      .single();

    if (se || !secret) {
      return jsonWithCookies({ error: 'Not found' }, cookieResponse);
    }

    let { data: sub } = await sb
      .from('submissions')
      .select('*')
      .eq('puzzle_idx', body.idx)
      .eq('anon_id', anon)
      .limit(1)
      .maybeSingle();

    if (!sub) {
      const tiebreak = msSinceLocalMidnight(body.tz);
      const ins = await sb
        .from('submissions')
        .insert({
          anon_id: anon,
          puzzle_idx: body.idx,
          lives_left: 3,
          guesses: [],
          tiebreak_ms: tiebreak,
        })
        .select('*')
        .single();
      sub = ins.data!;
    }

    if (sub.solved) {
      return jsonWithCookies(
        {
          alreadySolved: true,
          lives_left: sub.lives_left,
          points: sub.points,
          guesses: Array.isArray(sub.guesses) ? (sub.guesses as string[]) : [],
        },
        cookieResponse
      );
    }

    const guess = body.guess.trim().toLowerCase();
    const correct = guess === secret.target_word.toLowerCase();
    const prevGuesses: string[] = Array.isArray(sub.guesses) ? sub.guesses : [];

    if (correct) {
      const points = sub.lives_left;
      const upd = await sb
        .from('submissions')
        .update({
          solved: true,
          solved_at: new Date().toISOString(),
          points,
          guesses: prevGuesses.includes(guess) ? prevGuesses : [...prevGuesses, guess],
        })
        .eq('id', sub.id)
        .eq('solved', false)
        .select('lives_left,points,guesses')
        .maybeSingle();

      const curr =
        upd.data ??
        (await sb.from('submissions').select('lives_left,points,guesses').eq('id', sub.id).single()).data!;

      return jsonWithCookies(
        {
          correct: true,
          lives_left: curr.lives_left,
          points: curr.points,
          guesses: Array.isArray(curr.guesses) ? (curr.guesses as string[]) : prevGuesses,
        },
        cookieResponse
      );
    }

    // duplicate guess anywhere in history -> no decrement
    if (prevGuesses.includes(guess)) {
      const ll = sub.lives_left;
      return jsonWithCookies(
        {
          correct: false,
          duplicate: true,
          lives_left: ll,
          ...(ll <= 2 ? { firstLetter: secret.target_word[0] } : {}),
          ...(ll <= 1 ? { wordHint: secret.word_hint } : {}),
          gameOver: ll === 0,
          guesses: prevGuesses,
        },
        cookieResponse
      );
    }

    // new wrong guess -> decrement with optimistic lock
    const targetLives = Math.max(0, sub.lives_left - 1);
    const upd = await sb
      .from('submissions')
      .update({
        lives_left: targetLives,
        guesses: [...prevGuesses, guess],
      })
      .eq('id', sub.id)
      .eq('lives_left', sub.lives_left)
      .select('lives_left,guesses')
      .maybeSingle();

    const curr =
      upd.data ??
      (await sb.from('submissions').select('lives_left,guesses').eq('id', sub.id).single()).data!;

    const lives_left = curr.lives_left;
    const guesses = Array.isArray(curr.guesses) ? (curr.guesses as string[]) : [...prevGuesses, guess];

    const reveal: Record<string, string | undefined> = {};
    if (lives_left === 2) reveal.firstLetter = secret.target_word[0];
    if (lives_left === 1) reveal.wordHint = secret.word_hint;

    return jsonWithCookies(
      { correct: false, lives_left, ...reveal, gameOver: lives_left === 0, guesses },
      cookieResponse
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
