import { DateTime } from 'luxon';
const EPOCH_ISO = process.env.EPOCH_ISO ?? '2025-01-01';
export function todayKey(tz: string){
  const now = DateTime.now().setZone(tz);
  const start = DateTime.fromISO(EPOCH_ISO, { zone: tz }).startOf('day');
  const idx = Math.floor(now.startOf('day').diff(start,'days').days);
  return { idx, date: now.toISODate()! };
}
export function msSinceLocalMidnight(tz: string){
  const now = DateTime.now().setZone(tz);
  return Math.floor(now.diff(now.startOf('day')).as('milliseconds'));
}
