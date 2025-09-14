// src/lib/local-game.ts
export type LocalSub = {
  idx: number;
  guesses: string[];
  lives_left: number;
  solved: boolean;
  points: number;
  solved_at?: string;
  revealed_answer?: string; // when a guest loses and we reveal
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

/** NEW: list all guest games stored locally (sorted by idx desc). */
export function listAllLocal(): LocalSub[] {
  if (!hasWindow()) return [];
  const out: LocalSub[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(NS)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw) as LocalSub;
        if (obj && typeof obj.idx === 'number') out.push(obj);
      } catch {
        // ignore malformed entries
      }
    }
  } catch {
    return [];
  }
  // newest first
  out.sort((a, b) => b.idx - a.idx);
  return out;
}

/** Optional helpers some UIs need. */
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

export function upsertLocal(patch: Partial<LocalSub> & { idx: number }) {
  const prev = getLocal(patch.idx) ?? {
    idx: patch.idx,
    guesses: [],
    lives_left: 3,
    solved: false,
    points: 0,
  };
  setLocal({ ...prev, ...patch });
}
