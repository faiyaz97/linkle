// src/app/api/guess/route.ts
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idx = body?.idx;
    const guess = String(body?.guess ?? '');
    const reveal = !!body?.reveal;

    if (!Number.isInteger(idx) || !guess) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const anon = sbAnon();
    const { data: auth } = token ? await anon.auth.getUser(token) : { data: { user: null } as any };
    const user = auth?.user ?? null;

    const admin = sbAdmin();

    const { data: sec, error: secErr } = await admin
      .from('puzzles_secret')
      .select('target_word')
      .eq('idx', idx)
      .single();
    if (secErr || !sec?.target_word) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const target = String(sec.target_word).trim().toLowerCase();
    const normGuess = guess.trim().toLowerCase();

    // Guest: stateless validation. No DB writes.
    if (!user) {
      const correct = normGuess === target;
      return NextResponse.json({ correct, ...(reveal ? { answer: target } : {}) });
    }

    // Authenticated: persist in DB
    const START_LIVES = 3;

    const { data: sub } = await admin
      .from('submissions')
      .select('id,lives_left,solved,points,guesses,solved_at,created_at')
      .eq('puzzle_idx', idx)
      .eq('user_id', user.id)
      .maybeSingle();

    const existingGuesses: string[] = Array.isArray(sub?.guesses) ? (sub!.guesses as string[]) : [];
    const livesLeft = typeof sub?.lives_left === 'number' ? sub!.lives_left : START_LIVES;

    if (sub?.solved) {
      return NextResponse.json({
        alreadySolved: true as const,
        lives_left: livesLeft,
        points: sub.points ?? livesLeft,
        guesses: existingGuesses,
      });
    }
    if (sub && livesLeft === 0) {
      return NextResponse.json({
        correct: false as const,
        lives_left: 0,
        gameOver: true,
        guesses: existingGuesses,
        answer: target,
      });
    }

    if (existingGuesses.includes(normGuess)) {
      return NextResponse.json({
        correct: false as const,
        lives_left: livesLeft,
        gameOver: false,
        guesses: existingGuesses,
        duplicate: true,
      });
    }

    if (normGuess === target) {
      const newGuesses = [...existingGuesses, normGuess];
      const points = livesLeft;

      let upd;
      if (sub?.id) {
        const { data } = await admin
          .from('submissions')
          .update({ guesses: newGuesses, solved: true, points, solved_at: new Date().toISOString() })
          .eq('id', sub.id)
          .select('lives_left,points,guesses')
          .single();
        upd = data;
      } else {
        const { data } = await admin
          .from('submissions')
          .insert({
            user_id: user.id,
            puzzle_idx: idx,
            guesses: newGuesses,
            lives_left: START_LIVES,
            solved: true,
            points,
            solved_at: new Date().toISOString(),
          })
          .select('lives_left,points,guesses')
          .single();
        upd = data;
      }

      return NextResponse.json({
        correct: true as const,
        lives_left: upd?.lives_left ?? livesLeft,
        points: upd?.points ?? points,
        guesses: (upd?.guesses as string[]) ?? newGuesses,
      });
    } else {
      const nextLives = Math.max(0, livesLeft - 1);
      const newGuesses = [...existingGuesses, normGuess];

      let upd;
      if (sub?.id) {
        const { data } = await admin
          .from('submissions')
          .update({ guesses: newGuesses, lives_left: nextLives, solved: false })
          .eq('id', sub.id)
          .select('lives_left,guesses')
          .single();
        upd = data;
      } else {
        const { data } = await admin
          .from('submissions')
          .insert({
            user_id: user.id,
            puzzle_idx: idx,
            guesses: newGuesses,
            lives_left: nextLives,
            solved: false,
            points: 0,
          })
          .select('lives_left,guesses')
          .single();
        upd = data;
      }

      const gameOver = (upd?.lives_left ?? nextLives) === 0;
      return NextResponse.json({
        correct: false as const,
        lives_left: upd?.lives_left ?? nextLives,
        gameOver,
        guesses: (upd?.guesses as string[]) ?? newGuesses,
        ...(gameOver ? { answer: target } : {}),
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
