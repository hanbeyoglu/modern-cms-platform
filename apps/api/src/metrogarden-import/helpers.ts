import { createHash } from 'node:crypto';
import type { WorkingHoursSchedule } from '../common/types/working-hours';
import type { StoreSocialLink } from '../common/types/store-social-link';

export const SOURCE_SYSTEM = 'metrogarden';

export function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

export function isoDateAt(date: string, time = '00:00'): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${date}T${normalized}.000Z`;
}

export function isExpired(endDate: string | undefined, now = new Date()): boolean {
  if (!endDate) return false;
  // End of calendar day in UTC
  const end = new Date(`${endDate}T23:59:59.999Z`);
  return end.getTime() < now.getTime();
}

const DAY_ALIASES: Record<string, keyof WorkingHoursSchedule> = {
  pazartesi: 'monday',
  salı: 'tuesday',
  sali: 'tuesday',
  çarşamba: 'wednesday',
  carsamba: 'wednesday',
  perşembe: 'thursday',
  persembe: 'thursday',
  cuma: 'friday',
  cumartesi: 'saturday',
  pazar: 'sunday',
};

const DAY_ORDER: Array<keyof WorkingHoursSchedule> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function dayIndex(day: keyof WorkingHoursSchedule): number {
  return DAY_ORDER.indexOf(day);
}

/** Best-effort parse of Turkish free-text hours into CMS WorkingHoursSchedule. */
export function parseWorkingHoursText(raw?: string): {
  schedule?: WorkingHoursSchedule;
  unsupported: boolean;
} {
  if (!raw?.trim()) return { unsupported: false };
  const text = raw.trim();
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const schedule: WorkingHoursSchedule = {};
  let matched = false;

  for (const part of parts) {
    const m = part.match(
      /^(.+?)\s*[:：]\s*(\d{1,2}:\d{2})\s*[–\-—]\s*(\d{1,2}:\d{2})$/u,
    );
    if (!m) continue;
    const range = m[1].toLocaleLowerCase('tr-TR');
    const from = m[2].padStart(5, '0');
    const to = m[3].padStart(5, '0');
    const bounds = range.split(/\s*[–\-—]\s*/u).map((s) => s.trim());
    if (bounds.length === 1) {
      const day = DAY_ALIASES[bounds[0]];
      if (!day) continue;
      schedule[day] = { open: true, from, to };
      matched = true;
      continue;
    }
    const start = DAY_ALIASES[bounds[0]];
    const end = DAY_ALIASES[bounds[1]];
    if (!start || !end) continue;
    const startIdx = dayIndex(start);
    const endIdx = dayIndex(end);
    if (startIdx < 0 || endIdx < 0) continue;
    for (let i = startIdx; i <= endIdx; i += 1) {
      schedule[DAY_ORDER[i]] = { open: true, from, to };
    }
    matched = true;
  }

  if (!matched) return { unsupported: true };
  for (const day of DAY_ORDER) {
    if (!schedule[day]) schedule[day] = { open: false };
  }
  return { schedule, unsupported: false };
}

export function mapSocialLinks(raw?: Record<string, string>): {
  links: StoreSocialLink[];
  unsupported: string[];
} {
  if (!raw) return { links: [], unsupported: [] };
  const links: StoreSocialLink[] = [];
  const unsupported: string[] = [];
  for (const [key, url] of Object.entries(raw)) {
    if (!url) continue;
    const platform = key.toLowerCase();
    if (platform === 'instagram') links.push({ platform: 'INSTAGRAM', url });
    else if (platform === 'facebook') links.push({ platform: 'FACEBOOK', url });
    else if (platform === 'twitter' || platform === 'x') links.push({ platform: 'X', url });
    else if (platform === 'youtube') links.push({ platform: 'YOUTUBE', url });
    else if (platform === 'tiktok') links.push({ platform: 'TIKTOK', url });
    else if (platform === 'linkedin') links.push({ platform: 'LINKEDIN', url });
    else unsupported.push(`social_links.${key}`);
  }
  return { links, unsupported };
}

export function mapFloorLabel(floor?: string): string | undefined {
  if (!floor) return undefined;
  const key = floor.toLowerCase();
  if (key === 'ground' || key === 'zemin' || key === '0') return 'Zemin';
  if (key === '1f' || key === '1') return '1';
  if (key === '2f' || key === '2') return '2';
  if (key === '3f' || key === '3') return '3';
  if (key === 'b1' || key === '-1') return 'B1';
  return floor;
}

export function resolveAbsoluteUrl(href: string | undefined, siteBaseUrl: string): string | undefined {
  if (!href?.trim()) return undefined;
  const value = href.trim();
  if (value === '#') return undefined;
  try {
    return new URL(value, siteBaseUrl).toString();
  } catch {
    return undefined;
  }
}

export function categoryDisplayName(slug?: string): string {
  if (!slug) return 'Genel';
  const map: Record<string, string> = {
    fashion: 'Moda',
    electronics: 'Elektronik',
    beauty: 'Güzellik',
    sports: 'Spor',
    'food-and-beverage': 'Yeme & İçme',
    kids: 'Çocuk',
    entertainment: 'Eğlence',
    services: 'Hizmetler',
  };
  return map[slug] ?? slug;
}
