// src/app/page.tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import NavBar from '@/components/NavBar';
import Hearts from '@/components/Hearts';
import ClueTile from '@/components/ClueTile';
import AnswerTile from '@/components/AnswerTile';
import Footer from '@/components/Footer';
import Keyboard, { KeyState } from '@/components/Keyboard';
import LeaderboardDialog from '@/components/LeaderboardDialog';
import { supabase } from '@/lib/supabase-browser';
import { getLocal, setLocal, LocalSub } from '@/lib/local-game';

type Today = {
  idx: number;
  puzzle_date: string;
  local_date: string;
  clues: string[];
  submission: null | { lives_left: number; solved: boolean; points: number; guesses: string[] };
  answer?: string;
};

type GuessRespAuth =
  | { alreadySolved: true; lives_left: number; points: number; guesses?: string[] }
  | { correct: true; lives_left: number; points: number; guesses?: string[] }
  | { correct: false; lives_left: number; gameOver: boolean; guesses?: string[]; duplicate?: boolean; answer?: string };

type GuessRespGuest =
  | { correct: true }
  | { correct: false; answer?: string };

export default function Home() {
  const [tz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const [today, setToday] = useState<Today | undefined>();
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [lives, setLives] = useState(3);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [guess, setGuess] = useState<string>('');
  const [reveal, setReveal] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [missPulse, setMissPulse] = useState(false);
  const [shake, setShake] = useState(false);
  const [bumpTick, setBumpTick] = useState(0);
  const [celebrateTick, setCelebrateTick] = useState(0);
  const submitLock = useRef(false);
  const [lbOpen, setLbOpen] = useState(false);

  // session token for Authorization header
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessionToken(data.session?.access_token ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessionToken(s?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // load today's puzzle and hydrate state from server or local
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/today?tz=${encodeURIComponent(tz)}`, {
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
        });
        const data: Today = await r.json();
        if (cancelled) return;
        setToday(data);

        if (sessionToken) {
          // logged in: use server submission
          if (data.submission) {
            setLives(data.submission.lives_left ?? 3);
            const all = Array.isArray(data.submission.guesses) ? data.submission.guesses : [];
            setGuesses(all);
            setWrongGuesses(data.submission.solved ? all.slice(0, -1) : all);
            if (data.submission.solved) {
              setStatus('won');
              const ans = data.answer || all.at(-1) || '';
              setReveal(ans);
              setGuess(ans);
            } else if (data.submission.lives_left === 0) {
              setStatus('lost');
              if (data.answer) {
                setReveal(data.answer);
                setGuess(data.answer);
              } else {
                setReveal('');
                setGuess('');
              }
            } else {
              setStatus('playing');
              setGuess('');
              setReveal('');
            }
          } else {
            setLives(3);
            setGuesses([]);
            setWrongGuesses([]);
            setStatus('playing');
            setGuess('');
            setReveal('');
          }
        } else {
          // guest: hydrate from localStorage
          const local = getLocal(data.idx);
          if (local) {
            setLives(local.lives_left);
            setGuesses(local.guesses);
            setWrongGuesses(local.solved ? local.guesses.slice(0, -1) : local.guesses);
            if (local.solved) {
              setStatus('won');
              setReveal(local.guesses.at(-1) ?? '');
              setGuess(local.guesses.at(-1) ?? '');
            } else if (local.lives_left === 0) {
              setStatus('lost');
              // we do not store the answer locally; the UI will request reveal if needed after a final miss
              setReveal('');
              setGuess('');
            } else {
              setStatus('playing');
              setGuess('');
              setReveal('');
            }
          } else {
            setLives(3);
            setGuesses([]);
            setWrongGuesses([]);
            setStatus('playing');
            setGuess('');
            setReveal('');
          }
        }
      } catch {
        if (!cancelled) setToday(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tz, sessionToken]);

  function isDuplicateLocal(g: string) {
    const norm = g.trim().toLowerCase();
    return guesses.includes(norm);
  }

  // submit for logged-in users (persisted)
  const submitGuessAuth = useCallback(async () => {
    if (!today || status !== 'playing' || !guess.trim() || submitting || submitLock.current || !sessionToken) return;

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ idx: today.idx, guess: normGuess, tz }),
      });
      const res: GuessRespAuth = await r.json();

      if ('guesses' in res && Array.isArray(res.guesses)) setGuesses(res.guesses);

      if ('alreadySolved' in res) {
        setStatus('won');
        setLives(res.lives_left);
        const final = (res as any).guesses?.[(res as any).guesses.length - 1] ?? normGuess;
        setReveal(final);
        setGuess(final);
        setCelebrateTick((n) => n + 1);
        return;
      }

      if ('correct' in res && res.correct) {
        setStatus('won');
        setLives(res.lives_left);
        const final = res.guesses?.[res.guesses.length - 1] ?? normGuess;
        setReveal(final);
        setGuess(final);
        setCelebrateTick((n) => n + 1);
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
        if (res.gameOver) {
          setStatus('lost');
          if (res.answer && typeof res.answer === 'string') {
            setReveal(res.answer);
            setGuess(res.answer);
          } else {
            setGuess('');
          }
        } else {
          setGuess('');
        }
      } else {
        setGuess('');
      }
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        submitLock.current = false;
      }, 0);
    }
  }, [today, status, guess, submitting, tz, sessionToken, guesses]);

  // submit for guests (local only)
  const submitGuessGuest = useCallback(async () => {
    if (!today || status !== 'playing' || !guess.trim() || submitting || submitLock.current || sessionToken) return;

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
      // ask server only if the guess is correct; do not send any client lives
      const r = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idx: today.idx, guess: normGuess }),
      });
      const res: GuessRespGuest = await r.json();

      // prepare local submission
      const current: LocalSub = {
        idx: today.idx,
        guesses: [...guesses, normGuess],
        lives_left: lives,
        solved: false,
        points: 0,
      };

      if ('correct' in res && res.correct) {
        current.solved = true;
        current.points = current.lives_left;
        current.solved_at = new Date().toISOString();
        setLocal(current);

        setStatus('won');
        setGuesses(current.guesses);
        setWrongGuesses(current.guesses.slice(0, -1));
        setReveal(normGuess);
        setGuess(normGuess);
        setCelebrateTick((n) => n + 1);
        return;
      }

      // wrong
      current.lives_left = Math.max(0, current.lives_left - 1);
      setLocal(current);
      setLives(current.lives_left);
      setGuesses(current.guesses);
      setWrongGuesses(current.guesses);

      setMissPulse(true);
      setShake(true);
      setTimeout(() => setMissPulse(false), 220);
      setTimeout(() => setShake(false), 320);

      if (current.lives_left === 0) {
        // request reveal
        const rr = await fetch('/api/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idx: today.idx, guess: normGuess, reveal: true }),
        });
        const rj: GuessRespGuest = await rr.json();
        const ans = (rj as any).answer as string | undefined;

        setStatus('lost');
        if (ans) {
          setReveal(ans);
          setGuess(ans);
        } else {
          setGuess('');
        }
      } else {
        setGuess('');
      }
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        submitLock.current = false;
      }, 0);
    }
  }, [today, status, guess, submitting, guesses, lives, sessionToken]);

  const submitGuess = sessionToken ? submitGuessAuth : submitGuessGuest;

  // physical keyboard
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
        submitGuess();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, submitGuess]);

  const keyStates: Partial<Record<string, KeyState>> = {};
  for (const w of wrongGuesses) for (const ch of w.toUpperCase()) if (/[A-Z]/.test(ch)) keyStates[ch] = keyStates[ch] ?? 'miss';
  if (status === 'won' && guesses.length > 0) for (const ch of guesses[guesses.length - 1].toUpperCase()) if (/[A-Z]/.test(ch)) keyStates[ch] = 'correct';

  const kbEnabled = status === 'playing' && !submitting;
  const tileVariant: 'neutral' | 'success' | 'error' = status === 'won' ? 'success' : status === 'lost' ? 'error' : 'neutral';
  const tileValue = status === 'playing' ? guess : reveal || guess;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar onOpenLeaderboard={() => setLbOpen(true)} />

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
                {today!.clues.map((c, i) => (
                  <ClueTile key={i} text={c} />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-red-600">No clues available for today.</p>
            )}

            <div className={`mt-2 ${shake ? 'animate-shake' : ''}`}>
              <AnswerTile value={tileValue} disabled={true} bumpKey={bumpTick} celebrateKey={celebrateTick} variant={tileVariant} />
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
      <LeaderboardDialog open={lbOpen} onClose={() => setLbOpen(false)} tz={tz} />
    </div>
  );
}
