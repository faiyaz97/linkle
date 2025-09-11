// src/lib/local-game.ts
// Versioned local storage for anonymous play

const NS = 'linkle:v1';

export type LocalSub = {
  idx: number;
  guesses: string[];
  lives_left: number;  // 3..0
  solved: boolean;
  points: number;      // equals lives_left when solved
  solved_at?: string;  // ISO
};

const key = (idx: number) => `${NS}:p:${idx}`;

export function getLocal(idx: number): LocalSub | null {
  try {
    const s = localStorage.getItem(key(idx));
    return s ? (JSON.parse(s) as LocalSub) : null;
  } catch {
    return null;
  }
}

export function setLocal(s: LocalSub) {
  try {
    localStorage.setItem(key(s.idx), JSON.stringify(s));
  } catch {}
}

export function listAllLocal(): LocalSub[] {
  const out: LocalSub[] = [];
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`${NS}:p:`)) {
        const v = localStorage.getItem(k);
        if (v) out.push(JSON.parse(v) as LocalSub);
      }
    }
  } catch {}
  return out;
}

export function clearAllLocal() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`${NS}:`)) localStorage.removeItem(k);
    }
  } catch {}
}
