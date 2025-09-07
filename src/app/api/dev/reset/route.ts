import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const jar = cookies();
  const anon = jar.get('anon_id')?.value || null;
  const idxParam = req.nextUrl.searchParams.get('idx'); // optional
  const sb = sbAdmin();

  if (anon) {
    if (idxParam) {
      const idx = Number(idxParam);
      if (Number.isFinite(idx)) {
        await sb.from('submissions').delete().eq('anon_id', anon).eq('puzzle_idx', idx);
      }
    } else {
      await sb.from('submissions').delete().eq('anon_id', anon);
    }
  }

  const res = NextResponse.json({
    clearedCookie: !!anon,
    anon,
    scope: idxParam ? `idx=${idxParam}` : 'all',
  });
  // clear cookie
  res.cookies.set('anon_id', '', { path: '/', maxAge: 0 });
  return res;
}
