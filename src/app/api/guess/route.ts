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
    const guessRaw = body?.guess ?? '';
    const reveal = !!body?.reveal;

    if (!Number.isInteger(idx)) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const anon = sbAnon();
    const { data: auth } = token ? await anon.auth.getUser(token) : { data: { user: null } as any };
    const user = auth?.user ?? null;

    const admin = sbAdmin();

    // Fetch target
    const { data: sec, error: secErr } = await admin
      .from('puzzles_secret')
      .select('target_word')
      .eq('idx', idx)
      .single();
    if (secErr || !sec?.target_word) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const target = String(sec.target_word).trim().toLowerCase();

    // Support reveal-only calls (e.g., guest refresh after loss)
    if (reveal && (!guessRaw || String(guessRaw).trim() === '')) {
      return NextResponse.json({ answer: target });
    }

    const normGuess = String(guessRaw).trim().toLowerCase();
    if (!normGuess) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }

    // Guest: stateless validation. No DB writes.
    if (!user) {
      const correct = normGuess === target;
      return NextResponse.json({ correct, ...(reveal ? { answer: target } : {}) });
    }

    // Authenticated: persist in DB
    const START_LIVES = 3;

    // Read existing submission
    const { data: sub } = await admin
      .from('submissions')
      .select('id,lives_left,solved,points,guesses,solved_at,created_at')
      .eq('puzzle_idx', idx)
      .eq('user_id', user.id)
      .maybeSingle();

    const existingGuesses: string[] = Array.isArray(sub?.guesses) ? (sub!.guesses as string[]) : [];
    const livesLeft = typeof sub?.lives_left === 'number' ? sub!.lives_left : START_LIVES;

    // Already solved for this user
    if (sub?.solved) {
      // Include current streak so client can show dialog consistently
      const { data: uRow } = await admin
        .from('users')
        .select('streak_current,streak_best')
        .eq('id', user.id)
        .maybeSingle();

      return NextResponse.json({
        alreadySolved: true as const,
        lives_left: livesLeft,
        points: sub.points ?? livesLeft,
        guesses: existingGuesses,
        streak: uRow ? { current: uRow.streak_current ?? 0, best: uRow.streak_best ?? 0 } : undefined,
      });
    }

    // Out of lives
    if (sub && livesLeft === 0) {
      // Ensure streak reset persisted (idempotent)
      await admin
        .from('users')
        .update({ streak_current: 0, streak_last_idx: idx })
        .eq('id', user.id);
      return NextResponse.json({
        correct: false as const,
        lives_left: 0,
        gameOver: true,
        guesses: existingGuesses,
        answer: target,
      });
    }

    // Duplicate guess
    if (existingGuesses.includes(normGuess)) {
      return NextResponse.json({
        correct: false as const,
        lives_left: livesLeft,
        gameOver: false,
        guesses: existingGuesses,
        duplicate: true,
      });
    }

    // Correct guess
    if (normGuess === target) {
      const newGuesses = [...existingGuesses, normGuess];
      const points = livesLeft;

      let upd: { lives_left: number; points: number; guesses: string[] } | null = null;

      if (sub?.id) {
        const { data } = await admin
          .from('submissions')
          .update({ guesses: newGuesses, solved: true, points, solved_at: new Date().toISOString() })
          .eq('id', sub.id)
          .select('lives_left,points,guesses')
          .single();
        upd = data as any;
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
        upd = data as any;
      }

      // Streak update on first solve of idx
      const { data: u0 } = await admin
        .from('users')
        .select('streak_current,streak_best,streak_last_idx')
        .eq('id', user.id)
        .single();

      const cur = u0?.streak_current ?? 0;
      const best = u0?.streak_best ?? 0;
      const last = u0?.streak_last_idx ?? null;
      const nextCur = last === idx - 1 ? cur + 1 : 1;
      const nextBest = Math.max(best, nextCur);

      await admin
        .from('users')
        .update({ streak_current: nextCur, streak_best: nextBest, streak_last_idx: idx })
        .eq('id', user.id);

      return NextResponse.json({
        correct: true as const,
        lives_left: upd?.lives_left ?? livesLeft,
        points: upd?.points ?? points,
        guesses: (upd?.guesses as string[]) ?? newGuesses,
        streak: { current: nextCur, best: nextBest },
      });
    }

    // Wrong guess
    const nextLives = Math.max(0, livesLeft - 1);
    const newGuesses = [...existingGuesses, normGuess];

    let updW: { lives_left: number; guesses: string[] } | null = null;
    if (sub?.id) {
      const { data } = await admin
        .from('submissions')
        .update({ guesses: newGuesses, lives_left: nextLives, solved: false })
        .eq('id', sub.id)
        .select('lives_left,guesses')
        .single();
      updW = data as any;
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
      updW = data as any;
    }

    const finalLives = updW?.lives_left ?? nextLives;
    const gameOver = finalLives === 0;

    if (gameOver) {
      // Reset streak on loss
      await admin
        .from('users')
        .update({ streak_current: 0, streak_last_idx: idx })
        .eq('id', user.id);
    }

    return NextResponse.json({
      correct: false as const,
      lives_left: finalLives,
      gameOver,
      guesses: (updW?.guesses as string[]) ?? newGuesses,
      ...(gameOver ? { answer: target } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
