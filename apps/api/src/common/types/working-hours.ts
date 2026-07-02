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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function validateWorkingHours(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return 'Çalışma saatleri geçerli bir JSON nesnesi olmalıdır';
  }
  const obj = raw as Record<string, unknown>;
  for (const day of WORKING_HOUR_DAYS) {
    const slot = obj[day];
    if (slot === undefined || slot === null) continue;
    if (typeof slot !== 'object' || Array.isArray(slot)) {
      return `${day} için geçersiz çalışma saati`;
    }
    const row = slot as Record<string, unknown>;
    const open = Boolean(row.open);
    if (!open) continue;
    const from = String(row.from ?? '').trim();
    const to = String(row.to ?? '').trim();
    if (!from || !to) return `${day}: açık günlerde açılış ve kapanış saati zorunludur`;
    if (!TIME_RE.test(from) || !TIME_RE.test(to)) {
      return `${day}: saat formatı HH:MM olmalıdır`;
    }
    if (parseMinutes(to) <= parseMinutes(from)) {
      return `${day}: kapanış saati açılıştan sonra olmalıdır`;
    }
  }
  return null;
}
