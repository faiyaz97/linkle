// src/app/api/guess/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { msSinceLocalMidnight } from '@/lib/time';
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
      secure: process.env.NODE_ENV === 'production' ? true : false,
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return { anon, cookieResponse: res };
  }
  return { anon, cookieResponse: null as NextResponse | null };
}

function respond(payload: any, cookieResponse: NextResponse | null, status = 200) {
  return cookieResponse
    ? new NextResponse(JSON.stringify(payload), { status, headers: cookieResponse.headers })
    : NextResponse.json(payload, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { idx?: number; guess?: string; tz?: string } | null;
    if (!body || typeof body.idx !== 'number' || !body.guess || typeof body.tz !== 'string') {
      return NextResponse.json({ error: 'bad request' }, { status: 400 });
    }

    const { anon, cookieResponse } = ensureAnonCookie();
    const sb = sbAdmin();

    // read secret
    const { data: secret, error: se } = await sb
      .from('puzzles_secret')
      .select('target_word')
      .eq('idx', body.idx)
      .single();
    if (se || !secret) return respond({ error: 'Not found' }, cookieResponse, 404);

    const target = String(secret.target_word).toLowerCase();

    // fetch/create submission
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
      if (ins.error || !ins.data) {
        return respond({ error: ins.error?.message || 'create submission failed' }, cookieResponse, 500);
      }
      sub = ins.data;
    }

    // already solved
    if (sub.solved) {
      return respond(
        {
          alreadySolved: true as const,
          lives_left: sub.lives_left,
          points: sub.points,
          guesses: Array.isArray(sub.guesses) ? (sub.guesses as string[]) : [],
        },
        cookieResponse
      );
    }

    const guess = body.guess.trim().toLowerCase();
    const prevGuesses: string[] = Array.isArray(sub.guesses) ? sub.guesses : [];

    // correct -> solve
    if (guess === target) {
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

      return respond(
        {
          correct: true as const,
          lives_left: curr.lives_left,
          points: curr.points,
          guesses: Array.isArray(curr.guesses) ? (curr.guesses as string[]) : prevGuesses,
        },
        cookieResponse
      );
    }

    // duplicate wrong -> no decrement
    if (prevGuesses.includes(guess)) {
      return respond(
        {
          correct: false as const,
          duplicate: true,
          lives_left: sub.lives_left,
          gameOver: sub.lives_left === 0,
          guesses: prevGuesses,
        },
        cookieResponse
      );
    }

    // new wrong -> decrement with optimistic lock
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

    return respond(
      {
        correct: false as const,
        lives_left: curr.lives_left,
        gameOver: curr.lives_left === 0,
        guesses: Array.isArray(curr.guesses) ? (curr.guesses as string[]) : [...prevGuesses, guess],
      },
      cookieResponse
    );
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
