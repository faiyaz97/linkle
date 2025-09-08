// src/app/page.tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import NavBar from '@/components/NavBar';
import Hearts from '@/components/Hearts';
import ClueTile from '@/components/ClueTile';
import AnswerTile from '@/components/AnswerTile';
import Footer from '@/components/Footer';
import Keyboard, { KeyState } from '@/components/Keyboard';

type Today = {
  idx: number;
  puzzle_date: string;
  local_date: string;
  clues: string[];
  submission: null | { lives_left: number; solved: boolean; points: number; guesses: string[] };
};
type GuessResp =
  | { alreadySolved: true; lives_left: number; points: number; guesses?: string[] }
  | { correct: true; lives_left: number; points: number; guesses?: string[] }
  | { correct: false; lives_left: number; gameOver: boolean; guesses?: string[]; duplicate?: boolean };

export default function Home() {
  const [tz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [today, setToday] = useState<Today | undefined>();
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [lives, setLives] = useState(3);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [guess, setGuess] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [missPulse, setMissPulse] = useState(false);
  const [shake, setShake] = useState(false);
  const [bumpTick, setBumpTick] = useState(0);
  const submitLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/today?tz=${encodeURIComponent(tz)}`);
        const data: Today = await r.json();
        if (cancelled) return;
        setToday(data);
        if (data.submission) {
          setLives(data.submission.lives_left ?? 3);
          const all = Array.isArray(data.submission.guesses) ? data.submission.guesses : [];
          setGuesses(all);
          setWrongGuesses(data.submission.solved ? all.slice(0, -1) : all);
          if (data.submission.solved) setStatus('won');
          else if (data.submission.lives_left === 0) setStatus('lost');
          else setStatus('playing');
        } else {
          setLives(3);
          setGuesses([]);
          setWrongGuesses([]);
          setStatus('playing');
        }
      } catch {
        if (!cancelled) setToday(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [tz]);

  const submitGuess = useCallback(async () => {
    if (!today || status !== 'playing' || !guess.trim() || submitting || submitLock.current) return;

    const normGuess = guess.trim().toLowerCase();
    const isDup = guesses.includes(normGuess);
    if (isDup) {
      setShake(true);
      setTimeout(() => setShake(false), 320);
      setGuess('');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const r = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idx: today.idx, guess: normGuess, tz }),
      });
      const res: GuessResp = await r.json();

      if ('guesses' in res && Array.isArray(res.guesses)) setGuesses(res.guesses);

      if ('alreadySolved' in res) {
        setStatus('won');
        setLives(res.lives_left);
        if (Array.isArray((res as any).guesses)) setWrongGuesses((res as any).guesses.slice(0, -1));
        setGuess('');
        return;
      }

      if ('correct' in res && res.correct) {
        setStatus('won');
        setLives(res.lives_left);
        if (Array.isArray(res.guesses)) setWrongGuesses(res.guesses.slice(0, -1));
        setGuess('');
        return;
      }

      if ('correct' in res && !res.correct) {
        if ((res as any).duplicate) {
          setShake(true);
          setTimeout(() => setShake(false), 320);
          setGuess('');
          return;
        }
        setLives(res.lives_left);
        if (Array.isArray(res.guesses)) setWrongGuesses(res.guesses);
        else setWrongGuesses((prev) => [...prev, normGuess]);
        setMissPulse(true);
        setShake(true);
        setTimeout(() => setMissPulse(false), 220);
        setTimeout(() => setShake(false), 320);
        if (res.gameOver) setStatus('lost');
      }

      setGuess('');
    } finally {
      setSubmitting(false);
      setTimeout(() => { submitLock.current = false; }, 0);
    }
  }, [today, status, guess, submitting, tz, guesses]);

  // global physical keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (status !== 'playing') return;
      const k = e.key;
      if (/^[a-zA-Z]$/.test(k)) {
        e.preventDefault();
        setGuess((v) => v + k);
        setBumpTick((n) => n + 1);
      } else if (k === 'Backspace') {
        e.preventDefault();
        setGuess((v) => v.slice(0, -1));
      } else if (k === 'Enter') {
        e.preventDefault();
        submitGuess(); // always current because of useCallback
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, submitGuess]);

  const keyStates: Partial<Record<string, KeyState>> = {};
  for (const w of wrongGuesses) for (const ch of w.toUpperCase()) if (/[A-Z]/.test(ch)) keyStates[ch] = keyStates[ch] ?? 'miss';
  if (status === 'won' && guesses.length > 0) for (const ch of guesses[guesses.length - 1].toUpperCase()) if (/[A-Z]/.test(ch)) keyStates[ch] = 'correct';

  const kbEnabled = status === 'playing' && !submitting;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="w-full flex-1 flex items-center">
        <div className="w-full">
          <section className="mx-auto w-full max-w-md px-4">
            <div className="flex h-8 md:h-9 items-end justify-between">
              <div className="flex flex-wrap gap-x-1 leading-none">
                {wrongGuesses.map((g, i) => (
                  <span key={i} className="text-red-600 font-bold text-sm leading-none">
                    {g.toUpperCase()}
                  </span>
                ))}
              </div>
              <div className="shrink-0 flex items-end leading-none">
                <Hearts lives={lives} pulse={missPulse} />
              </div>
            </div>

            {Array.isArray(today?.clues) && today!.clues.length > 0 ? (
              <div className="space-y-2 mt-2">
                {today!.clues.map((c, i) => <ClueTile key={i} text={c} />)}
              </div>
            ) : (
              <p className="mt-4 text-sm text-red-600">No clues available for today.</p>
            )}

            {status !== 'playing' && (
              <div className="mt-3 rounded-md border border-black/10 bg-gray-100 p-3 text-center">
                {status === 'won' ? (
                  <p className="font-bold">Correct. Points: {lives}. Come back tomorrow.</p>
                ) : (
                  <p className="font-bold">No lives left. Try again tomorrow.</p>
                )}
              </div>
            )}

            <div className={`mt-2 ${shake ? 'animate-shake' : ''}`}>
              <AnswerTile value={guess} disabled={submitting || status !== 'playing'} bumpKey={bumpTick} />
            </div>
          </section>

          <section className="mx-auto w-full max-w-xl px-4">
            <Keyboard
              className="mt-4"
              states={keyStates}
              onKey={(ch) => {
                if (!kbEnabled) return;
                setGuess((v) => v + ch);
                setBumpTick((n) => n + 1);
              }}
              onBackspace={() => kbEnabled && setGuess((v) => v.slice(0, -1))}
              onEnter={() => kbEnabled && submitGuess()}
            />
          </section>
        </div>
      </main>

      <div className="w-full flex justify-center">
        <Footer idx={today?.idx} localDate={today?.local_date} tz={tz} />
      </div>
    </div>
  );
}
