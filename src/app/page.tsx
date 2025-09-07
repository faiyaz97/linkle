// src/app/page.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import NavBar from '@/components/NavBar';
import Hearts from '@/components/Hearts';
import ClueTile from '@/components/ClueTile';
import AnswerTile from '@/components/AnswerTile';
import Footer from '@/components/Footer';

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
  const [guess, setGuess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [missPulse, setMissPulse] = useState(false);
  const [shake, setShake] = useState(false);
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

  function isDuplicateLocal(g: string) {
    const norm = g.trim().toLowerCase();
    return guesses.includes(norm);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!today || status !== 'playing' || !guess.trim() || submitting || submitLock.current) return;

    const normGuess = guess.trim().toLowerCase();
    if (isDuplicateLocal(normGuess)) {
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
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-grow flex flex-col items-center">
        <div className="max-w-md w-full p-4">
          {Array.isArray(today?.clues) && today!.clues.length > 0 ? (
            <div className="mt-2 space-y-3">
              {today!.clues.map((c, i) => (
                <ClueTile key={i} text={c} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-red-600">No clues available for today.</p>
          )}

          <form className={`mt-6 ${shake ? 'animate-shake' : ''}`} onSubmit={onSubmit}>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <AnswerTile
                  value={guess}
                  onChange={setGuess}
                  disabled={submitting || status !== 'playing'}
                  placeholder="ANSWER"
                />
              </div>

              <div className="h-[80px] flex flex-col items-stretch justify-between">
                <div className="pointer-events-none">
                  <Hearts lives={lives} pulse={missPulse} />
                </div>
                <button
                  type="submit"
                  className="h-[40px] w-full rounded-md bg-black text-white hover:brightness-95 active:brightness-90 font-bold disabled:opacity-60"
                  disabled={submitting || status !== 'playing' || !guess.trim()}
                  aria-label="Submit guess"
                >
                  GUESS
                </button>
              </div>
            </div>
          </form>

          <div className="mt-1">
            {wrongGuesses.map((g, i) => (
              <span key={i} className="text-red-600 font-bold tracking-wide pr-2">
                {g.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Centered footer wrapper kept */}
      <div className="w-full flex justify-center">
        <Footer idx={today?.idx} localDate={today?.local_date} tz={tz} />
      </div>
    </div>
  );
}
