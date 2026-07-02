export const WORKING_HOUR_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WorkingHourDay = (typeof WORKING_HOUR_DAYS)[number];

export type WorkingHourSlot = {
  open: boolean;
  from?: string;
  to?: string;
};

export type WorkingHoursSchedule = Partial<Record<WorkingHourDay, WorkingHourSlot>>;

export type WorkingHoursMode =
  | 'USE_MALL_HOURS'
  | 'SAME_EVERY_DAY'
  | 'WEEKDAY_WEEKEND'
  | 'CUSTOM_BY_DAY';

export const WORKING_HOURS_MODE_LABELS: Record<WorkingHoursMode, string> = {
  USE_MALL_HOURS: 'AVM çalışma saatlerini kullan',
  SAME_EVERY_DAY: 'Her gün aynı saat',
  WEEKDAY_WEEKEND: 'Hafta içi / hafta sonu farklı',
  CUSTOM_BY_DAY: 'Günlere göre özel saat',
};

export const WORKING_HOUR_DAY_LABELS: Record<WorkingHourDay, string> = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

const WEEKDAYS: WorkingHourDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const WEEKEND: WorkingHourDay[] = ['saturday', 'sunday'];

const DEFAULT_FROM = '10:00';
const DEFAULT_TO = '22:00';

export type TimeRange = { from: string; to: string };

export type WorkingHoursEditorState = {
  sameEveryDay: TimeRange;
  weekdayHours: TimeRange;
  weekendHours: TimeRange;
  customByDay: WorkingHoursSchedule;
};

export function defaultWorkingHoursEditorState(): WorkingHoursEditorState {
  return {
    sameEveryDay: { from: DEFAULT_FROM, to: DEFAULT_TO },
    weekdayHours: { from: DEFAULT_FROM, to: DEFAULT_TO },
    weekendHours: { from: DEFAULT_FROM, to: DEFAULT_TO },
    customByDay: emptyWorkingHours(),
  };
}

export function emptyWorkingHours(): WorkingHoursSchedule {
  const schedule: WorkingHoursSchedule = {};
  for (const day of WORKING_HOUR_DAYS) {
    schedule[day] = { open: false, from: DEFAULT_FROM, to: DEFAULT_TO };
  }
  return schedule;
}

function slotEquals(a?: WorkingHourSlot, b?: WorkingHourSlot): boolean {
  const left = a ?? { open: false };
  const right = b ?? { open: false };
  if (left.open !== right.open) return false;
  if (!left.open) return true;
  return (left.from ?? DEFAULT_FROM) === (right.from ?? DEFAULT_FROM)
    && (left.to ?? DEFAULT_TO) === (right.to ?? DEFAULT_TO);
}

function scheduleHasOpenDay(schedule: WorkingHoursSchedule): boolean {
  return WORKING_HOUR_DAYS.some((day) => schedule[day]?.open);
}

function allDaysMatch(schedule: WorkingHoursSchedule, reference?: WorkingHourSlot): boolean {
  const ref = reference ?? schedule[WORKING_HOUR_DAYS[0]];
  return WORKING_HOUR_DAYS.every((day) => slotEquals(schedule[day], ref));
}

function weekdayWeekendMatch(schedule: WorkingHoursSchedule): boolean {
  const weekdayRef = schedule[WEEKDAYS[0]];
  const weekendRef = schedule[WEEKEND[0]];
  const weekdaysOk = WEEKDAYS.every((day) => slotEquals(schedule[day], weekdayRef));
  const weekendOk = WEEKEND.every((day) => slotEquals(schedule[day], weekendRef));
  return weekdaysOk && weekendOk;
}

export function detectWorkingHoursMode(schedule: WorkingHoursSchedule | null): WorkingHoursMode {
  if (schedule === null) return 'USE_MALL_HOURS';
  if (!scheduleHasOpenDay(schedule)) return 'USE_MALL_HOURS';
  if (allDaysMatch(schedule)) return 'SAME_EVERY_DAY';
  if (weekdayWeekendMatch(schedule)) return 'WEEKDAY_WEEKEND';
  return 'CUSTOM_BY_DAY';
}

export function extractSameEveryDay(schedule: WorkingHoursSchedule): TimeRange {
  for (const day of WORKING_HOUR_DAYS) {
    const slot = schedule[day];
    if (slot?.open) {
      return { from: slot.from ?? DEFAULT_FROM, to: slot.to ?? DEFAULT_TO };
    }
  }
  return { from: DEFAULT_FROM, to: DEFAULT_TO };
}

export function extractWeekdayWeekend(schedule: WorkingHoursSchedule): {
  weekday: TimeRange;
  weekend: TimeRange;
} {
  const weekdaySlot = schedule[WEEKDAYS[0]];
  const weekendSlot = schedule[WEEKEND[0]];
  return {
    weekday: {
      from: weekdaySlot?.from ?? DEFAULT_FROM,
      to: weekdaySlot?.to ?? DEFAULT_TO,
    },
    weekend: {
      from: weekendSlot?.from ?? DEFAULT_FROM,
      to: weekendSlot?.to ?? DEFAULT_TO,
    },
  };
}

export function scheduleToCustomByDay(schedule: WorkingHoursSchedule | null): WorkingHoursSchedule {
  const base = schedule ?? emptyWorkingHours();
  return WORKING_HOUR_DAYS.reduce<WorkingHoursSchedule>((acc, day) => {
    const slot = base[day];
    acc[day] = slot?.open
      ? { open: true, from: slot.from ?? DEFAULT_FROM, to: slot.to ?? DEFAULT_TO }
      : { open: false, from: DEFAULT_FROM, to: DEFAULT_TO };
    return acc;
  }, {});
}

export function initWorkingHoursEditorState(
  schedule: WorkingHoursSchedule | null,
): { mode: WorkingHoursMode } & WorkingHoursEditorState {
  const mode = detectWorkingHoursMode(schedule);
  const base = schedule ?? emptyWorkingHours();
  const ranges = extractWeekdayWeekend(base);
  return {
    mode,
    sameEveryDay: extractSameEveryDay(base),
    weekdayHours: ranges.weekday,
    weekendHours: ranges.weekend,
    customByDay: mode === 'CUSTOM_BY_DAY'
      ? scheduleToCustomByDay(schedule)
      : emptyWorkingHours(),
  };
}

export function parseWorkingHours(raw: unknown): WorkingHoursSchedule | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.useMallHours === true) return null;

  const schedule: WorkingHoursSchedule = {};
  let hasAnyDay = false;
  for (const day of WORKING_HOUR_DAYS) {
    const slot = obj[day];
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue;
    hasAnyDay = true;
    const row = slot as Record<string, unknown>;
    schedule[day] = {
      open: Boolean(row.open),
      from: String(row.from ?? DEFAULT_FROM),
      to: String(row.to ?? DEFAULT_TO),
    };
  }
  if (!hasAnyDay) return null;
  if (!scheduleHasOpenDay(schedule)) return null;
  return schedule;
}

function parseMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function validateTimeRange(from: string, to: string, label: string): string | null {
  if (!from || !to) return `${label}: açılış ve kapanış saati zorunlu`;
  if (parseMinutes(to) <= parseMinutes(from)) {
    return `${label}: kapanış saati açılıştan sonra olmalı`;
  }
  return null;
}

export function validateWorkingHoursSchedule(schedule: WorkingHoursSchedule | null): string | null {
  if (schedule === null) return null;
  for (const day of WORKING_HOUR_DAYS) {
    const slot = schedule[day];
    if (!slot?.open) continue;
    if (!slot.from || !slot.to) {
      return `${WORKING_HOUR_DAY_LABELS[day]}: açılış ve kapanış saati zorunlu`;
    }
    if (parseMinutes(slot.to) <= parseMinutes(slot.from)) {
      return `${WORKING_HOUR_DAY_LABELS[day]}: kapanış saati açılıştan sonra olmalı`;
    }
  }
  return null;
}

export function validateWorkingHoursEditor(
  mode: WorkingHoursMode,
  state: WorkingHoursEditorState,
): string | null {
  if (mode === 'USE_MALL_HOURS') return null;
  if (mode === 'SAME_EVERY_DAY') {
    return validateTimeRange(state.sameEveryDay.from, state.sameEveryDay.to, 'Çalışma saatleri');
  }
  if (mode === 'WEEKDAY_WEEKEND') {
    const weekdayErr = validateTimeRange(
      state.weekdayHours.from,
      state.weekdayHours.to,
      'Hafta içi',
    );
    if (weekdayErr) return weekdayErr;
    return validateTimeRange(state.weekendHours.from, state.weekendHours.to, 'Hafta sonu');
  }
  return validateWorkingHoursSchedule(state.customByDay);
}

export function applyHoursToDays(
  schedule: WorkingHoursSchedule,
  days: WorkingHourDay[],
  from: string,
  to: string,
  open = true,
): WorkingHoursSchedule {
  const next = { ...schedule };
  for (const day of days) {
    next[day] = open ? { open: true, from, to } : { open: false };
  }
  return next;
}

export function buildScheduleFromMode(
  mode: WorkingHoursMode,
  state: WorkingHoursEditorState,
): WorkingHoursSchedule | null {
  switch (mode) {
    case 'USE_MALL_HOURS':
      return null;
    case 'SAME_EVERY_DAY':
      return applyHoursToDays(
        {},
        [...WORKING_HOUR_DAYS],
        state.sameEveryDay.from,
        state.sameEveryDay.to,
      );
    case 'WEEKDAY_WEEKEND':
      return {
        ...applyHoursToDays({}, WEEKDAYS, state.weekdayHours.from, state.weekdayHours.to),
        ...applyHoursToDays({}, WEEKEND, state.weekendHours.from, state.weekendHours.to),
      };
    case 'CUSTOM_BY_DAY':
      return WORKING_HOUR_DAYS.reduce<WorkingHoursSchedule>((acc, day) => {
        const slot = state.customByDay[day] ?? { open: false, from: DEFAULT_FROM, to: DEFAULT_TO };
        acc[day] = slot.open
          ? { open: true, from: slot.from ?? DEFAULT_FROM, to: slot.to ?? DEFAULT_TO }
          : { open: false };
        return acc;
      }, {});
    default:
      return null;
  }
}

export function workingHoursToPayload(
  schedule: WorkingHoursSchedule | null,
): Record<string, WorkingHourSlot> | null {
  if (schedule === null) return null;
  const out: Record<string, WorkingHourSlot> = {};
  for (const day of WORKING_HOUR_DAYS) {
    const slot = schedule[day];
    if (!slot) continue;
    out[day] = slot.open
      ? { open: true, from: slot.from ?? DEFAULT_FROM, to: slot.to ?? DEFAULT_TO }
      : { open: false };
  }
  return out;
}

export function formatDaySummary(slot?: WorkingHourSlot): string {
  if (!slot?.open) return 'Kapalı';
  return `${slot.from ?? DEFAULT_FROM} / ${slot.to ?? DEFAULT_TO}`;
}

export { WEEKDAYS, WEEKEND };

// ─── Special Days ─────────────────────────────────────────────────────────────

export type SpecialDay = {
  date: string;   // "YYYY-MM-DD" or "MM-DD" for recurring annual
  title: string;
  open: boolean;
  from?: string;  // "HH:MM" when open
  to?: string;    // "HH:MM" when open
};

export function parseSpecialDays(raw: unknown): SpecialDay[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const arr = (raw as Record<string, unknown>).specialDays;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      date: String(item.date ?? ''),
      title: String(item.title ?? ''),
      open: Boolean(item.open),
      from: item.from ? String(item.from) : undefined,
      to: item.to ? String(item.to) : undefined,
    }))
    .filter((d) => d.date.length > 0 && d.title.length > 0);
}

export function parseFullPayload(raw: unknown): {
  schedule: WorkingHoursSchedule | null;
  specialDays: SpecialDay[];
} {
  return {
    schedule: parseWorkingHours(raw),
    specialDays: parseSpecialDays(raw),
  };
}

export function buildFullPayload(
  schedule: WorkingHoursSchedule | null,
  specialDays: SpecialDay[],
): Record<string, unknown> | null {
  const payload = workingHoursToPayload(schedule);
  if (!payload && specialDays.length === 0) return null;
  return {
    ...(payload ?? {}),
    ...(specialDays.length > 0 ? { specialDays } : {}),
  };
}

// ─── Preview helpers ──────────────────────────────────────────────────────────

const DAY_SHORT: Record<WorkingHourDay, string> = {
  monday: 'Pzt', tuesday: 'Sal', wednesday: 'Çar',
  thursday: 'Per', friday: 'Cum', saturday: 'Cmt', sunday: 'Paz',
};

export function getTodayDayKey(): WorkingHourDay {
  const keys: WorkingHourDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return keys[new Date().getDay()];
}

export type PreviewLine = { label: string; value: string; isToday?: boolean };

export function generateSchedulePreview(schedule: WorkingHoursSchedule | null): PreviewLine[] {
  if (!schedule) return [];
  const todayKey = getTodayDayKey();
  const lines: PreviewLine[] = [];
  const visited = new Set<WorkingHourDay>();

  for (let i = 0; i < WORKING_HOUR_DAYS.length; i++) {
    const startDay = WORKING_HOUR_DAYS[i];
    if (visited.has(startDay)) continue;
    const startSlot = schedule[startDay];
    const summary = startSlot?.open
      ? `${startSlot.from ?? DEFAULT_FROM} – ${startSlot.to ?? DEFAULT_TO}`
      : 'Kapalı';

    // Extend the run as long as subsequent days have the same slot
    let endDay = startDay;
    for (let j = i + 1; j < WORKING_HOUR_DAYS.length; j++) {
      const nextDay = WORKING_HOUR_DAYS[j];
      const nextSlot = schedule[nextDay];
      const nextSummary = nextSlot?.open
        ? `${nextSlot.from ?? DEFAULT_FROM} – ${nextSlot.to ?? DEFAULT_TO}`
        : 'Kapalı';
      if (nextSummary !== summary) break;
      endDay = nextDay;
      visited.add(nextDay);
    }
    visited.add(startDay);

    const label =
      startDay === endDay
        ? WORKING_HOUR_DAY_LABELS[startDay]
        : `${DAY_SHORT[startDay]} – ${DAY_SHORT[endDay]}`;

    const rangeCoversToday = (() => {
      const start = WORKING_HOUR_DAYS.indexOf(startDay);
      const end = WORKING_HOUR_DAYS.indexOf(endDay);
      const today = WORKING_HOUR_DAYS.indexOf(todayKey);
      return today >= start && today <= end;
    })();

    lines.push({ label, value: summary, isToday: rangeCoversToday });
  }
  return lines;
}
