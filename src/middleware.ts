import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  // Refresh session and set auth cookies on responses
  await supabase.auth.getSession();
  return res;
}

// Run on account and API routes (and their callbacks)
export const config = {
  matcher: ['/account', '/account/:path*', '/api/:path*'],
};
