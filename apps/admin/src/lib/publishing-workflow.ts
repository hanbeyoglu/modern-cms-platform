export type PublishWorkflowStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export const STATUS_LABELS: Record<PublishWorkflowStatus, string> = {
  DRAFT: 'Taslak',
  SCHEDULED: 'Zamanlanmış',
  PUBLISHED: 'Yayında',
  ARCHIVED: 'Arşiv',
};

export const STATUS_HELPER: Record<PublishWorkflowStatus, string> = {
  DRAFT: 'Taslak içerikler public tarafta görünmez.',
  SCHEDULED: 'İçerik belirtilen tarihte otomatik yayınlanır.',
  PUBLISHED: 'İçerik şu anda yayında.',
  ARCHIVED: 'Arşivlenen içerik public tarafta görünmez; admin panelinde kalır.',
};

export function showsScheduleFields(status: PublishWorkflowStatus): boolean {
  return status === 'SCHEDULED' || status === 'PUBLISHED' || status === 'ARCHIVED';
}

export function schedulePrimaryRequired(status: PublishWorkflowStatus): boolean {
  return status === 'SCHEDULED';
}

export function schedulePrimaryDisabled(status: PublishWorkflowStatus): boolean {
  return status === 'DRAFT';
}

export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function validatePageSchedule(
  status: PublishWorkflowStatus,
  publishAt: string,
): string | null {
  if (status === 'SCHEDULED') {
    if (!publishAt.trim()) return 'Zamanlanmış içerik için yayın tarihi zorunludur.';
    const at = new Date(publishAt);
    if (Number.isNaN(at.getTime())) return 'Geçerli bir yayın tarihi girin.';
    if (at.getTime() <= Date.now()) return 'Zamanlanmış yayın tarihi gelecekte olmalıdır.';
  }
  return null;
}

export function validateRangeSchedule(
  status: PublishWorkflowStatus,
  startAt: string,
): string | null {
  if (status === 'SCHEDULED') {
    if (!startAt.trim()) return 'Zamanlanmış içerik için yayın tarihi zorunludur.';
    const at = new Date(startAt);
    if (Number.isNaN(at.getTime())) return 'Geçerli bir yayın tarihi girin.';
    if (at.getTime() <= Date.now()) return 'Zamanlanmış yayın tarihi gelecekte olmalıdır.';
  }
  return null;
}

/** On status → PUBLISHED, prefill primary schedule if empty. */
export function primaryScheduleForPublished(current: string): string {
  if (current.trim()) return current;
  return toDatetimeLocalValue(new Date().toISOString());
}
