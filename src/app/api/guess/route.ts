import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  try {
    const { idx, guess } = await req.json();
    if (!Number.isInteger(idx) || !guess || typeof guess !== 'string') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const { anon, cookieResponse } = ensureAnonCookie();
    const sb = sbAdmin();

    // Fetch target word
    const { data: sec, error: secErr } = await sb
      .from('puzzles_secret')
      .select('target_word')
      .eq('idx', idx)
      .single();

    if (secErr || !sec?.target_word) {
      const payload = { error: secErr?.message ?? 'Puzzle not found' };
      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { status: 404, headers: cookieResponse.headers })
        : NextResponse.json(payload, { status: 404 });
    }

    const target = String(sec.target_word).trim().toLowerCase();
    const normGuess = String(guess).trim().toLowerCase();
    const START_LIVES = 3;

    // Read existing submission
    const { data: sub } = await sb
      .from('submissions')
      .select('id, lives_left, solved, points, guesses')
      .eq('puzzle_idx', idx)
      .eq('anon_id', anon)
      .maybeSingle();

    const existingGuesses: string[] = Array.isArray(sub?.guesses) ? (sub!.guesses as string[]) : [];
    const livesLeft = typeof sub?.lives_left === 'number' ? sub!.lives_left : START_LIVES;

    // Already finished?
    if (sub?.solved) {
      const payload = {
        alreadySolved: true as const,
        lives_left: livesLeft,
        points: sub.points ?? livesLeft,
        guesses: existingGuesses,
      };
      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
        : NextResponse.json(payload);
    }
    if (sub && livesLeft === 0) {
      const payload = {
        correct: false as const,
        lives_left: 0,
        gameOver: true,
        guesses: existingGuesses,
        answer: target, // IMPORTANT: reveal on loss
      };
      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
        : NextResponse.json(payload);
    }

    // Duplicate guess?
    if (existingGuesses.includes(normGuess)) {
      const payload = {
        correct: false as const,
        lives_left: livesLeft,
        gameOver: false,
        guesses: existingGuesses,
        duplicate: true,
      };
      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
        : NextResponse.json(payload);
    }

    // Process guess
    if (normGuess === target) {
      const newGuesses = [...existingGuesses, normGuess];
      const points = livesLeft;

      let upd;
      if (sub?.id) {
        const { data } = await sb
          .from('submissions')
          .update({
            guesses: newGuesses,
            solved: true,
            points,
            solved_at: new Date().toISOString(),
          })
          .eq('id', sub.id)
          .select('lives_left, points, guesses')
          .single();
        upd = data;
      } else {
        const { data } = await sb
          .from('submissions')
          .insert({
            anon_id: anon,
            puzzle_idx: idx,
            guesses: newGuesses,
            lives_left: START_LIVES,
            solved: true,
            points,
            solved_at: new Date().toISOString(),
          })
          .select('lives_left, points, guesses')
          .single();
        upd = data;
      }

      const payload = {
        correct: true as const,
        lives_left: upd?.lives_left ?? livesLeft,
        points: upd?.points ?? points,
        guesses: (upd?.guesses as string[]) ?? newGuesses,
      };
      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
        : NextResponse.json(payload);
    } else {
      // Wrong guess: decrement life
      const nextLives = Math.max(0, livesLeft - 1);
      const newGuesses = [...existingGuesses, normGuess];

      let upd;
      if (sub?.id) {
        const { data } = await sb
          .from('submissions')
          .update({
            guesses: newGuesses,
            lives_left: nextLives,
            solved: false,
          })
          .eq('id', sub.id)
          .select('lives_left, guesses')
          .single();
        upd = data;
      } else {
        const { data } = await sb
          .from('submissions')
          .insert({
            anon_id: anon,
            puzzle_idx: idx,
            guesses: newGuesses,
            lives_left: nextLives,
            solved: false,
            points: 0,
          })
          .select('lives_left, guesses')
          .single();
        upd = data;
      }

      const gameOver = (upd?.lives_left ?? nextLives) === 0;
      const payload = {
        correct: false as const,
        lives_left: upd?.lives_left ?? nextLives,
        gameOver,
        guesses: (upd?.guesses as string[]) ?? newGuesses,
        ...(gameOver ? { answer: target } : {}), // reveal on loss
      };

      return cookieResponse
        ? new NextResponse(JSON.stringify(payload), { headers: cookieResponse.headers })
        : NextResponse.json(payload);
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
