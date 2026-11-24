/**
 * Sample Metrogarden content was authored around early July 2026
 * ("this week" window). Shifting relative to that keeps durations intact
 * while making active content current on import day.
 */
export const DEMO_CONTENT_ANCHOR_DATE = '2026-07-01';

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateOnly(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetweenUtc(from: string, to: Date): number {
  const a = parseDateOnly(from);
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a.getTime()) / 86_400_000);
}

export function shiftDateOnly(value: string | undefined, shiftDays: number): string | undefined {
  if (!value) return value;
  if (!shiftDays) return value;
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + shiftDays);
  return formatDateOnly(date);
}

export function computeDemoShiftDays(now = new Date(), anchor = DEMO_CONTENT_ANCHOR_DATE): number {
  return daysBetweenUtc(anchor, now);
}

export type PublicVisibilityEstimate = {
  campaigns: number;
  events: number;
  movies: number;
  sliders: number;
};

export function estimatePublicVisibility(opts: {
  campaigns: Array<{ start_date?: string; end_date?: string; is_active?: boolean; status?: string }>;
  events: Array<{ date?: string; end_date?: string }>;
  movies: Array<{ status?: string; is_current?: boolean }>;
  sliders: Array<{ is_active?: boolean }>;
  shiftDates: boolean;
  now?: Date;
}): PublicVisibilityEstimate {
  const now = opts.now ?? new Date();
  const shiftDays = opts.shiftDates ? computeDemoShiftDays(now) : 0;

  const today = formatDateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );

  const inWindow = (start?: string, end?: string): boolean => {
    const s = shiftDateOnly(start, shiftDays);
    const e = shiftDateOnly(end ?? start, shiftDays);
    if (!s) return false;
    if (s > today) return false;
    if (e && e < today) return false;
    return true;
  };

  const campaigns = opts.campaigns.filter((c) => {
    if (c.is_active === false || c.status === 'expired') return false;
    return inWindow(c.start_date, c.end_date);
  }).length;

  const events = opts.events.filter((e) => inWindow(e.date, e.end_date ?? e.date)).length;

  const movies = opts.movies.filter((m) => {
    if (opts.shiftDates) return m.is_current !== false && m.status !== 'coming-soon';
    return m.is_current === true || m.status === 'now-showing';
  }).length;

  const sliders = opts.sliders.filter((s) => s.is_active !== false).length;

  return { campaigns, events, movies, sliders };
}
