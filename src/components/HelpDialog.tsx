// src/components/HelpDialog.tsx
'use client';

import { X, CircleHelp } from 'lucide-react';
import React, { useEffect } from 'react';
import Link from 'next/link';

export default function HelpDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-[92vw] max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-black/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
              <CircleHelp className="h-4 w-4" />
            </div>
            <div className="font-semibold">How to play</div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-black/5 active:bg-black/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold mb-1">Goal</h3>
            <p>Find the single word that connects the 5 clue words shown.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Lives and guesses</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>You have 3 lives per day. Each wrong guess loses 1 life.</li>
              <li>Duplicate guesses do not count or cost a life.</li>
              <li>When you solve, the answer locks in and turns green.</li>
              <li>If you run out of lives, the correct answer is revealed in red.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Scoring</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>3 lives left = 3 points, 2 lives = 2 points, 1 life = 1 point, 0 = 0.</li>
              <li>Points contribute to weekly and all-time leaderboards.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Streaks</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Streak increases for each consecutive day you solve.</li>
              <li>Missing a day or losing breaks the streak.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Daily reset & timezone</h3>
            <p>The puzzle resets at your local midnight based on your device timezone.</p>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Controls</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Type on your keyboard, use Backspace to delete, Enter to submit.</li>
              <li>Or use the on-screen keyboard.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-1">Accounts</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Play without signing in. Progress is saved on this device only.</li>
              <li>Sign in to sync points and streaks across devices and appear on leaderboards.</li>
            </ul>
          </section>

          {!/** optional CTA when logged out could go here; omitted to match other dialogs **/false && null}
        </div>
      </div>
    </div>
  );
}
