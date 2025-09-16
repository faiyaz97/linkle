// src/lib/local-game.ts
export type LocalSub = {
  idx: number;
  guesses: string[];
  lives_left: number;
  solved: boolean;
  points: number;
  solved_at?: string;
  revealed_answer?: string;

  // streak fields (guest)
  streak_current?: number;
  streak_best?: number;
  streak_last_idx?: number;
};

const NS = 'linkle:v1:';
const keyOf = (idx: number) => `${NS}${idx}`;
const hasWindow = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function getLocal(idx: number): LocalSub | null {
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(keyOf(idx));
    if (!raw) return null;
    return JSON.parse(raw) as LocalSub;
  } catch {
    return null;
  }
}

export function setLocal(sub: LocalSub) {
  if (!hasWindow()) return;
  try {
    localStorage.setItem(keyOf(sub.idx), JSON.stringify(sub));
  } catch {}
}

export function clearLocal(idx: number) {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(keyOf(idx));
  } catch {}
}

export function clearAllLocal() {
  if (!hasWindow()) return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(NS)) keys.push(k);
  }
  keys.forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
}

export function listAllLocal(): LocalSub[] {
  if (!hasWindow()) return [];
  const out: LocalSub[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(NS)) continue;
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw) as LocalSub;
      if (obj && typeof obj.idx === 'number') out.push(obj);
    } catch {}
  }
  out.sort((a, b) => b.idx - a.idx);
  return out;
}

/** Streak helpers for guests */
export function applyWinStreak(idx: number, sub: LocalSub): LocalSub {
  const cur = sub.streak_current ?? 0;
  const best = sub.streak_best ?? 0;
  const last = sub.streak_last_idx ?? null;

  const nextCur = last === idx - 1 ? cur + 1 : 1;
  const nextBest = Math.max(best, nextCur);
  const patched = { ...sub, streak_current: nextCur, streak_best: nextBest, streak_last_idx: idx };
  setLocal(patched);
  return patched;
}

export function applyLossStreak(idx: number, sub: LocalSub): LocalSub {
  const patched = { ...sub, streak_current: 0, streak_last_idx: idx };
  setLocal(patched);
  return patched;
}
