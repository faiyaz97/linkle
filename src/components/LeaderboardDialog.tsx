// src/components/LeaderboardDialog.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Trophy, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-browser';

type Week = { id: number; start_date: string; end_date: string; seq: number | null };
type Row = { user_id: string; username: string; points: number; rank: number };

export default function LeaderboardDialog({
  open,
  onClose,
  tz,
}: {
  open: boolean;
  onClose: () => void;
  tz: string;
}) {
  const [tab, setTab] = useState<'week' | 'all'>('week');

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentWeekId, setCurrentWeekId] = useState<number | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);

  const [top, setTop] = useState<Row[]>([]);
  const [me, setMe] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const loggedIn = !!token;

  useEffect(() => {
    if (!open) return;
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => data.subscription.unsubscribe();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const r = await fetch(`/api/leaderboard/weeks?tz=${encodeURIComponent(tz)}`, { cache: 'no-store' });
      const j = await r.json();
      if (Array.isArray(j.weeks)) {
        setWeeks(j.weeks);
        setCurrentWeekId(j.current_week_id ?? null);
        setSelectedWeekId(j.current_week_id ?? j.weeks[0]?.id ?? null);
      }
    })();
  }, [open, tz]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        if (tab === 'week') {
          const wid = selectedWeekId ?? currentWeekId;
          if (!wid) return;
          const r = await fetch(`/api/leaderboard/week?week_id=${wid}`, {
            cache: 'no-store',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          const j = await r.json();
          setTop(Array.isArray(j.top) ? j.top : []);
          setMe(Array.isArray(j.me) ? (j.me[0] ?? null) : j.me ?? null);
        } else {
          const r = await fetch(`/api/leaderboard/alltime`, {
            cache: 'no-store',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          const j = await r.json();
          setTop(Array.isArray(j.top) ? j.top : []);
          setMe(Array.isArray(j.me) ? (j.me[0] ?? null) : j.me ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, tab, selectedWeekId, currentWeekId, token]);

  const headerLabel = useMemo(() => {
    if (tab === 'all') return 'All time';
    const wk = weeks.find((w) => w.id === (selectedWeekId ?? currentWeekId));
    if (!wk) return 'This week';
    const fmt = (d: string) =>
      new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const seq = wk.seq ? `Week ${wk.seq} • ` : '';
    return `${seq}${fmt(wk.start_date)} – ${fmt(wk.end_date)}`;
  }, [tab, weeks, selectedWeekId, currentWeekId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-[92vw] max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-black/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="font-semibold">Leaderboard</div>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-2 rounded-md hover:bg-black/5 active:bg-black/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="inline-flex rounded-lg border bg-white p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm ${tab === 'week' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
              onClick={() => setTab('week')}
            >
              This week
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm ${tab === 'all' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
              onClick={() => setTab('all')}
            >
              All time
            </button>
          </div>
        </div>

        {tab === 'week' && (
          <div className="px-4 pt-3">
            <label className="block text-xs text-black/60 mb-1">Select week</label>
            <div className="relative">
              <select
                value={String(selectedWeekId ?? currentWeekId ?? '')}
                onChange={(e) => setSelectedWeekId(Number(e.target.value))}
                className="w-full h-10 appearance-none border rounded-lg pl-3 pr-9 bg-white"
              >
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {`Week ${w.seq ?? '?'} — ${w.start_date} to ${w.end_date}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/60" />
            </div>
          </div>
        )}

        <div className="px-4 pt-3 pb-2 text-xs text-black/60">{headerLabel}</div>

        <div className="px-4 pb-3">
          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_4rem] bg-black/5 text-xs font-medium sticky top-0">
              <div className="px-2 py-2">#</div>
              <div className="px-2 py-2">Username</div>
              <div className="px-2 py-2 text-right">Pts</div>
            </div>

            <div className="max-h-80 overflow-auto">
              {loading ? (
                <div className="p-4 text-sm text-black/60">Loading…</div>
              ) : top.length === 0 ? (
                <div className="p-4 text-sm text-black/60">No data yet.</div>
              ) : (
                top.map((r) => {
                  const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null;
                  const isMe = me && r.user_id === me.user_id;
                  return (
                    <div
                      key={r.user_id}
                      className={`grid grid-cols-[3rem_1fr_4rem] border-t text-sm ${
                        isMe ? 'bg-yellow-50/70' : 'bg-white'
                      }`}
                    >
                      <div className="px-2 py-2">{medal ?? r.rank}</div>
                      <div className="px-2 py-2 flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white text-xs font-semibold">
                          {r.username?.[0]?.toUpperCase() ?? '?'}
                        </span>
                        <span className="truncate">{r.username}</span>
                      </div>
                      <div className="px-2 py-2 text-right font-semibold">{r.points}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* My row (no yellow highlight) */}
          <div className="mt-3">
            {loggedIn ? (
              me ? (
                <div className="rounded-xl border overflow-hidden bg-white">
                  <div className="grid grid-cols-[3rem_1fr_4rem] text-sm">
                    <div className="px-2 py-2">
                      {me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : me.rank}
                    </div>
                    <div className="px-2 py-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white text-xs font-semibold">
                        {me.username?.[0]?.toUpperCase() ?? '?'}
                      </span>
                      <span className="truncate">{me.username}</span>
                    </div>
                    <div className="px-2 py-2 text-right font-semibold">{me.points}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-black/60">Not ranked in this period yet.</div>
              )
            ) : (
              <div className="text-sm">
                <Link href="/account?src=auth" className="underline hover:opacity-80" onClick={onClose}>
                  Sign in to see your rank
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
