import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(_req: NextRequest) {
  const jar = cookies();
  const anon = jar.get('anon_id')?.value;
  const auth = createRouteHandlerClient({ cookies });
  const { data: { user } } = await auth.auth.getUser();
  if (!user || !anon) return NextResponse.json({ moved: 0, kept: 0 }, { status: 200 });

  const sb = sbAdmin();

  // fetch anon submissions
  const { data: anonSubs } = await sb
    .from('submissions')
    .select('id, puzzle_idx, guesses, lives_left, solved, points, solved_at, created_at')
    .eq('anon_id', anon);

  if (!anonSubs || anonSubs.length === 0) return NextResponse.json({ moved: 0, kept: 0 });

  let moved = 0, kept = 0;

  for (const a of anonSubs) {
    // does a user row already exist for this puzzle?
    const { data: exist } = await sb
      .from('submissions')
      .select('id, points, solved, lives_left, guesses, solved_at, created_at')
      .eq('user_id', user.id)
      .eq('puzzle_idx', a.puzzle_idx)
      .maybeSingle();

    if (!exist) {
      // attach anon row to user
      await sb.from('submissions').update({ user_id: user.id, anon_id: null }).eq('id', a.id);
      moved++;
    } else {
      // keep the better record: prefer higher points, then solved, then earlier solved_at
      const pickAnon =
        (a.points ?? 0) > (exist.points ?? 0) ||
        ((a.points ?? 0) === (exist.points ?? 0) && !!a.solved && !exist.solved) ||
        ((a.points ?? 0) === (exist.points ?? 0) && !!a.solved && !!exist.solved && (a.solved_at ?? a.created_at) < (exist.solved_at ?? exist.created_at));

      if (pickAnon) {
        await sb.from('submissions').update({
          guesses: a.guesses, lives_left: a.lives_left, solved: a.solved,
          points: a.points, solved_at: a.solved_at,
        }).eq('id', exist.id);
        await sb.from('submissions').delete().eq('id', a.id);
        moved++;
      } else {
        await sb.from('submissions').delete().eq('id', a.id);
        kept++;
      }
    }
  }

  return NextResponse.json({ moved, kept });
}
