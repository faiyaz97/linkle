'use client';
import { useEffect, useRef, useState } from 'react';
import Hearts from '@/components/Hearts';

type Today = {
  idx: number;
  puzzle_date: string;
  local_date: string;
  clues: string[];
  submission: null | { lives_left: number; solved: boolean; points: number; guesses: string[] };
  hints: { firstLetter?: string; wordHint?: string };
};
type GuessResp =
  | { alreadySolved: true; lives_left: number; points: number; guesses?: string[] }
  | { correct: true; lives_left: number; points: number; guesses?: string[] }
  | {
      correct: false;
      lives_left: number;
      firstLetter?: string;
      wordHint?: string;
      gameOver: boolean;
      guesses?: string[];
      duplicate?: boolean;
    };

export default function Home() {
  const [tz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [today, setToday] = useState<Today | undefined>();
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [lives, setLives] = useState(3);

  const [firstLetter, setFirstLetter] = useState<string | undefined>();
  const [wordHint, setWordHint] = useState<string | undefined>();

  // all guesses (for duplicate checks)
  const [guesses, setGuesses] = useState<string[]>([]);
  // wrong answers only (for display)
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);

  const [guess, setGuess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [missPulse, setMissPulse] = useState(false);
  const [shake, setShake] = useState(false);
  const submitLock = useRef(false);

  // Load today's puzzle + server submission state and hints
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/today?tz=${encodeURIComponent(tz)}`);
        const data: Today = await r.json();
        if (cancelled) return;
        setToday(data);

        // sync lives/status
        if (data.submission) {
          setLives(data.submission.lives_left ?? 3);
          setGuesses(Array.isArray(data.submission.guesses) ? data.submission.guesses : []);
          // wrongs = all guesses so far unless solved, then exclude final correct
          const base = Array.isArray(data.submission.guesses) ? data.submission.guesses : [];
          setWrongGuesses(data.submission.solved ? base.slice(0, -1) : base);
          if (data.submission.solved) setStatus('won');
          else if (data.submission.lives_left === 0) setStatus('lost');
          else setStatus('playing');
        } else {
          setLives(3);
          setGuesses([]);
          setWrongGuesses([]);
          setStatus('playing');
        }

        // restore hints
        setFirstLetter(data.hints?.firstLetter);
        setWordHint(data.hints?.wordHint);
      } catch {
        if (!cancelled) setToday(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
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

      // sync guesses if server sends them
      if ('guesses' in res && Array.isArray(res.guesses)) {
        setGuesses(res.guesses);
      }

      if ('alreadySolved' in res) {
        setStatus('won');
        setLives(res.lives_left);
        // wrongs may be everything except last if server included guesses
        if (Array.isArray((res as any).guesses)) {
          const arr = (res as any).guesses as string[];
          setWrongGuesses(arr.slice(0, -1));
        }
        setGuess('');
        return;
      }

      if ('correct' in res && res.correct) {
        setStatus('won');
        setLives(res.lives_left);
        if (Array.isArray(res.guesses)) {
          setWrongGuesses(res.guesses.slice(0, -1));
        }
        setGuess('');
        return;
      }

      if ('correct' in res && !res.correct) {
        if (res.duplicate) {
          setShake(true);
          setTimeout(() => setShake(false), 320);
          setGuess('');
          return;
        }
        setLives(res.lives_left);
        if (res.firstLetter) setFirstLetter(res.firstLetter);
        if (res.wordHint) setWordHint(res.wordHint);

        // append wrong guess locally and from server if provided
        if (Array.isArray(res.guesses)) {
          setWrongGuesses(res.guesses); // server already appended
        } else {
          setWrongGuesses((prev) => [...prev, normGuess]);
        }

        setMissPulse(true);
        setShake(true);
        setTimeout(() => setMissPulse(false), 220);
        setTimeout(() => setShake(false), 320);
        if (res.gameOver) setStatus('lost');
      }

      setGuess('');
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        submitLock.current = false;
      }, 0);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <header className="w-full border-b border-black/10 bg-white/70 backdrop-blur sticky top-0">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-wide">LINKLE</h1>
          <Hearts lives={lives} pulse={missPulse} />
        </div>
      </header>

      <div className="mx-auto max-w-md w-full px-4 pt-8">
        <p className="text-xs text-black/60">
          Puzzle: {today?.puzzle_date ?? '…'} • Local: {today?.local_date ?? '…'} • TZ: {tz}
        </p>

        {Array.isArray(today?.clues) && today!.clues.length > 0 ? (
          <div className="mt-4 space-y-3">
            {today!.clues.map((c, i) => (
              <div
                key={i}
                className="h-16 flex items-center justify-center rounded-md bg-white text-lg font-semibold tracking-wide shadow-sm border border-black/10"
              >
                {c.toUpperCase()}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-red-600">No clues available for today.</p>
        )}

        {/* Hints */}
        <div className="mt-4 text-sm">
          {firstLetter && (
            <p className="font-medium">
              First letter: <span className="font-bold">{firstLetter.toUpperCase()}</span>
            </p>
          )}
          {wordHint && <p className="font-medium">Hint: {wordHint}</p>}
        </div>

        {/* Answer input */}
        <form className={`mt-6 ${shake ? 'animate-shake' : ''}`} onSubmit={onSubmit}>
          <div className="flex gap-2">
            <input
              className="flex-1 h-12 px-4 rounded-md bg-white border border-black/10 shadow-sm text-lg uppercase tracking-wide"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="TYPE ANSWER"
              disabled={submitting || status !== 'playing'}
            />
            <button
              type="submit"
              className="h-12 px-4 rounded-md bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-black font-bold disabled:opacity-60"
              disabled={submitting || status !== 'playing' || !guess.trim()}
            >
              GUESS
            </button>
          </div>
        </form>

        {/* Wrong answers under input as red bold text */}
        <div className="mt-3 flex flex-wrap gap-x-2">
          {wrongGuesses.map((g, i) => (
            <p key={i} className="text-red-600 font-bold tracking-wide">
              {g.toUpperCase()}
            </p>
          ))}
        </div>

        {status !== 'playing' && (
          <div className="mt-6 p-4 bg-white rounded-md border border-black/10 shadow-sm">
            {status === 'won' ? (
              <p className="font-semibold">Correct. Points: {lives}</p>
            ) : (
              <p className="font-semibold">Out of lives. Try tomorrow.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
