/*
 * One place for date maths.
 *
 * The bug this file exists to prevent: `new Date('2026-10-27')` is midnight UTC,
 * so in any timezone behind UTC a task due "today" looks one day old, and a task
 * due today in a forward timezone looks tiny. Everything here works on plain
 * YYYY-MM-DD strings and whole days, never on raw timestamps.
 */

const DAY = 86_400_000;

/** Today in the viewer's own timezone, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
}

/** A value coming from the API or a date input, reduced to YYYY-MM-DD. */
export function isoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

/** Whole days from `from` to `to`. Negative means `to` is in the past. */
export function dayDiff(to: string | null | undefined, from: string = todayISO()): number | null {
  const a = isoDate(to);
  if (!a) return null;
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** Is the date strictly before today? A task due today is not late. */
export function isOverdue(due: unknown, now: string = todayISO()): boolean {
  const d = dayDiff(isoDate(due), now);
  return d !== null && d < 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '27 Oct' — short, unambiguous, no timezone games. */
export function shortDate(due: unknown): string {
  const d = isoDate(due);
  if (!d) return '—';
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? ''}`;
}

/** How a due date should read on a card, and how loudly. */
export function dueWords(due: unknown, done = false): { text: string; tone: 'late' | 'soon' | 'calm' } | null {
  const diff = dayDiff(isoDate(due));
  if (diff === null) return null;
  if (done) return { text: shortDate(due), tone: 'calm' };
  if (diff < 0) return { text: `${Math.abs(diff)}d late`, tone: 'late' };
  if (diff === 0) return { text: 'today', tone: 'soon' };
  if (diff === 1) return { text: 'tomorrow', tone: 'soon' };
  if (diff <= 3) return { text: `${diff}d`, tone: 'soon' };
  return { text: shortDate(due), tone: 'calm' };
}

/** 'YYYY-MM-DD' in a week — used when creating a task or a plan. */
export function plusDays(days: number, from: string = todayISO()): string {
  const base = Date.parse(`${isoDate(from) ?? todayISO()}T00:00:00Z`);
  return new Date(base + days * DAY).toISOString().slice(0, 10);
}
