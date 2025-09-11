// src/app/api/account/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type LocalSub = {
  idx: number;
  guesses: string[];
  lives_left: number;
  solved: boolean;
  points: number;
  solved_at?: string;
};

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
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const anon = sbAnon();
    const { data: { user } } = await anon.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { strategy, items } = (await req.json()) as { strategy: 'merge' | 'overwrite' | 'discard'; items: LocalSub[] };
    if (!['merge', 'overwrite', 'discard'].includes(strategy)) return NextResponse.json({ error: 'Bad strategy' }, { status: 400 });

    const admin = sbAdmin();

    if (strategy === 'discard') {
      await admin.from('users').update({ onboarded: true }).eq('id', user.id);
      return NextResponse.json({ ok: true, moved: 0, kept: 0 });
    }

    const idxs = Array.from(new Set(items.map((i) => i.idx)));
    const { data: existing } = await admin
      .from('submissions')
      .select('id,puzzle_idx,points,solved,lives_left,guesses,solved_at,created_at')
      .eq('user_id', user.id)
      .in('puzzle_idx', idxs);

    const existByIdx = new Map<number, any>((existing ?? []).map((r) => [r.puzzle_idx, r]));
    let moved = 0,
      kept = 0;

    for (const it of items) {
      const ex = existByIdx.get(it.idx);

      if (!ex) {
        await admin.from('submissions').insert({
          user_id: user.id,
          puzzle_idx: it.idx,
          guesses: it.guesses,
          lives_left: it.lives_left,
          solved: it.solved,
          points: it.points,
          solved_at: it.solved ? (it.solved_at ?? new Date().toISOString()) : null,
        });
        moved++;
        continue;
      }

      if (strategy === 'overwrite') {
        await admin
          .from('submissions')
          .update({
            guesses: it.guesses,
            lives_left: it.lives_left,
            solved: it.solved,
            points: it.points,
            solved_at: it.solved ? (it.solved_at ?? ex.solved_at) : null,
          })
          .eq('id', ex.id);
        moved++;
        continue;
      }

      // merge
      const pickAnon =
        (it.points ?? 0) > (ex.points ?? 0) ||
        ((it.points ?? 0) === (ex.points ?? 0) && !!it.solved && !ex.solved) ||
        ((it.points ?? 0) === (ex.points ?? 0) &&
          !!it.solved &&
          !!ex.solved &&
          (new Date(it.solved_at ?? new Date()).toISOString() < (ex.solved_at ?? ex.created_at)));

      if (pickAnon) {
        await admin
          .from('submissions')
          .update({
            guesses: it.guesses,
            lives_left: it.lives_left,
            solved: it.solved,
            points: it.points,
            solved_at: it.solved ? (it.solved_at ?? ex.solved_at) : null,
          })
          .eq('id', ex.id);
        moved++;
      } else {
        kept++;
      }
    }

    await admin.from('users').update({ onboarded: true }).eq('id', user.id);
    return NextResponse.json({ ok: true, moved, kept });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
