// src/components/EndgameDialog.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

type Props = {
  open: boolean;
  variant: 'win' | 'loss';
  streak?: { current: number; best: number } | null;
  loggedIn: boolean;
  onClose: () => void;
};

export default function EndgameDialog({ open, variant, streak, loggedIn, onClose }: Props) {
  if (!open) return null;

  const isWin = variant === 'win';
  const icon = isWin ? '🏆' : '💥';
  const title = isWin ? 'You solved it' : 'No lives left';
  const subtitle = isWin ? 'Back tomorrow for a new one.' : 'Try again tomorrow.';
  const accent = isWin ? 'bg-emerald-600' : 'bg-rose-600';

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      {/* Centered Card */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-black/10 animate-pop-in"
        >
          {/* Top accent bar */}
          <div className={`h-1.5 w-full rounded-t-2xl ${accent}`} />

          {/* Floating badge */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2">
            <div className="h-14 w-14 rounded-2xl bg-white shadow-lg border border-black/10 grid place-items-center animate-badge-float">
              <span className="text-2xl">{icon}</span>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-black/5"
          >
            ✕
          </button>

          {/* Body */}
          <div className="px-5 pt-10 pb-5">
            <h2 className="text-center text-xl font-extrabold tracking-tight">{title}</h2>
            <p className="mt-1 text-center text-sm text-black/65">{subtitle}</p>

            {/* Streak chips */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {streak ? (
                <>
                  <Chip>
                    <span aria-hidden>🔥</span>
                    <span className="ml-1">Streak</span>
                    <strong className="ml-1 text-base">{streak.current ?? 0}</strong>
                  </Chip>
                  <Chip outline>
                    <span aria-hidden>🏅</span>
                    <span className="ml-1">Best</span>
                    <strong className="ml-1">{streak.best ?? 0}</strong>
                  </Chip>
                </>
              ) : (
                <div className="text-sm text-black/60">Progress saved.</div>
              )}
            </div>

            {/* CTA when logged out */}
            {!loggedIn && (
              <div className="mt-5 text-center">
                <p className="text-sm text-black/75">
                  Keep your points and streak saved across all devices.
                </p>
                <Link
                  href="/account"
                  className="mt-2 inline-flex items-center rounded-lg bg-black px-4 py-2 text-sm font-bold text-white hover:brightness-95"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  outline = false,
}: {
  children: React.ReactNode;
  outline?: boolean;
}) {
  const cls = outline
    ? 'border border-black/15 text-black/80'
    : 'bg-black/5 text-black';
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm ${cls}`}>
      {children}
    </span>
  );
}
