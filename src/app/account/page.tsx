// src/app/account/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mail, Apple, Facebook, LogOut } from 'lucide-react';
import { listAllLocal, clearAllLocal } from '@/lib/local-game';

export default function AccountPage() {
  const router = useRouter();
  const params = useSearchParams();
  const fromAuth = params.get('src') === 'auth'; // only auto-redirect on auth callback

  const [email, setEmail] = useState('');
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null);
  const [profile, setProfile] = useState<{ email?: string; username?: string; onboarded?: boolean } | null>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const localItems = useMemo(() => listAllLocal(), []);
  const hasLocal = localItems.length > 0;
  const checkedExistingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile; decide if we bounce to game only on callback
  useEffect(() => {
    (async () => {
      if (!session) return;

      const { data, error } = await supabase
        .from('users')
        .select('email,username,onboarded')
        .eq('id', session.user.id)
        .single();

      if (!error && data) {
        setProfile(data);
        setUsername((data.username ?? '').toLowerCase());

        if (fromAuth) {
          // Existing user → go straight to game
          if (data.onboarded) {
            router.replace('/');
            return;
          }
          // Not marked onboarded, but has server progress → mark then go
          if (!checkedExistingRef.current) {
            checkedExistingRef.current = true;
            const { count } = await supabase
              .from('submissions')
              .select('id', { head: true, count: 'exact' })
              .eq('user_id', session.user.id);
            if ((count ?? 0) > 0) {
              await fetch('/api/account/onboarded', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              router.replace('/');
              return;
            }
          }
          // New user: stay here to set username and optionally import local
        }
        // Manual visit: never auto-redirect
      }
    })();
  }, [session, router, fromAuth]);

  async function signInWithEmail() {
    if (!email) return;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/account?src=auth` },
    });
    alert('Check your email for a login link.');
  }
  async function oauth(provider: 'google' | 'apple' | 'facebook') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/account?src=auth` },
    });
  }

  async function saveUsername() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) return alert('Sign in again.');
    setSaving(true);
    const r = await fetch('/api/account/username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
      body: JSON.stringify({ username }),
    });
    setSaving(false);
    if (!r.ok) return alert((await r.json()).error ?? 'Failed');

    // Mark onboarded after successful save, then go to game
    await fetch('/api/account/onboarded', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.access_token}` },
    });
    router.replace('/');
  }

  async function importLocal(strategy: 'merge' | 'overwrite' | 'discard') {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) return alert('Sign in again.');
    const r = await fetch('/api/account/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
      body: JSON.stringify({ strategy, items: localItems }),
    });
    if (!r.ok) return alert((await r.json()).error ?? 'Import failed');
    clearAllLocal();
    router.replace('/');
  }

  async function continueWithoutChanges() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) return;
    await fetch('/api/account/onboarded', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.access_token}` },
    });
    router.replace('/');
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearAllLocal();
    router.replace('/');
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <button
        onClick={() => router.push('/')}
        className="absolute left-4 top-4 inline-flex items-center gap-2 text-black hover:opacity-80"
      >
        <ArrowLeft className="w-5 h-5" /> Back to game
      </button>

      <div className="w-full max-w-md">
        {!session ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-center">Sign in</h1>

            <button
              onClick={() => oauth('google')}
              className="w-full h-12 rounded-md border flex items-center justify-center gap-2 hover:bg-black/5"
            >
              <img src="https://www.svgrepo.com/show/355037/google.svg" alt="" className="h-5 w-5" />
              Continue with Google
            </button>

            <button
              onClick={() => oauth('apple')}
              className="w-full h-12 rounded-md border flex items-center justify-center gap-2 hover:bg-black/5"
            >
              <Apple className="h-5 w-5" /> Continue with Apple
            </button>

            <button
              onClick={() => oauth('facebook')}
              className="w-full h-12 rounded-md border flex items-center justify-center gap-2 hover:bg-black/5"
            >
              <Facebook className="h-5 w-5" /> Continue with Facebook
            </button>

            <div className="relative my-2 text-center text-sm text-black/60">or</div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 h-12 border rounded-md px-3 outline-none"
                />
                <button
                  onClick={signInWithEmail}
                  disabled={!email}
                  className="h-12 px-4 rounded-md bg-black text-white disabled:opacity-50"
                >
                  <Mail className="inline-block mr-2 w-4 h-4" /> Send Link
                </button>
              </div>
              <p className="text-xs text-black/60">We’ll email you a login link.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-center">Account</h1>

            <div className="rounded-md border p-3">
              <div className="text-sm text-black/60">Email</div>
              <div className="font-mono">{profile?.email ?? session.user.email}</div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm text-black/60">Username</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="your_name"
                  className="flex-1 h-12 border rounded-md px-3 outline-none"
                />
                <button
                  onClick={saveUsername}
                  disabled={!username.match(/^[a-z0-9_]{3,20}$/) || loading || saving}
                  className="h-12 px-4 rounded-md bg-black text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              <p className="text-xs text-black/60">3–20 chars. Lowercase letters, numbers, underscore.</p>
            </div>

            {/* One-time import when NOT onboarded and there is local progress */}
            {!profile?.onboarded && hasLocal && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="font-semibold">Import your previous progress</div>
                <p className="text-sm text-black/70">We found progress on this device. Choose one:</p>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => importLocal('merge')} className="h-12 rounded-md bg-black text-white">
                    Merge with my account
                  </button>
                  <button onClick={() => importLocal('overwrite')} className="h-12 rounded-md border">
                    Overwrite account with device progress
                  </button>
                  <button onClick={() => importLocal('discard')} className="h-12 rounded-md border">
                    Discard device progress
                  </button>
                </div>
              </div>
            )}

            {/* If no local to import and not onboarded, allow continue */}
            {!profile?.onboarded && !hasLocal && (
              <button
                onClick={continueWithoutChanges}
                className="w-full h-12 rounded-md bg-black text-white"
              >
                Continue to game
              </button>
            )}

            <button onClick={signOut} className="w-full h-12 rounded-md border hover:bg-black/5">
              <LogOut className="inline-block mr-2 h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
