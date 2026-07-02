export const STORE_SOCIAL_PLATFORMS = [
  'INSTAGRAM',
  'FACEBOOK',
  'X',
  'TIKTOK',
  'YOUTUBE',
  'LINKEDIN',
  'WEBSITE',
  'OTHER',
] as const;

export type StoreSocialPlatform = (typeof STORE_SOCIAL_PLATFORMS)[number];

export type StoreSocialLink = {
  platform: StoreSocialPlatform;
  url: string;
};

export function parseStoreSocialLinks(raw: unknown): StoreSocialLink[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreSocialLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const platform = String(row.platform ?? '').toUpperCase();
    const url = String(row.url ?? '').trim();
    if (!STORE_SOCIAL_PLATFORMS.includes(platform as StoreSocialPlatform)) continue;
    if (!url) continue;
    out.push({ platform: platform as StoreSocialPlatform, url });
  }
  return out;
}

export function validateStoreSocialLinks(links: StoreSocialLink[]): string | null {
  const seen = new Set<string>();
  for (const link of links) {
    try {
      // eslint-disable-next-line no-new
      new URL(link.url);
    } catch {
      return `Geçersiz URL: ${link.url}`;
    }
    if (link.platform !== 'OTHER') {
      if (seen.has(link.platform)) {
        return `${link.platform} platformu yalnızca bir kez eklenebilir`;
      }
      seen.add(link.platform);
    }
  }
  return null;
}
