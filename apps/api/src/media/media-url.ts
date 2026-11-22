/**
 * Detect URLs that are only reachable on a developer machine or local API disk.
 */
export function isLocalLikeMediaUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const raw = url.trim();
  if (raw.startsWith('file:')) return true;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      return true;
    }
    // Relative-style /uploads paths accidentally stored without a public host
    if (!parsed.protocol.startsWith('http')) return true;
    return false;
  } catch {
    return raw.includes('/uploads/') || raw.startsWith('/') || raw.startsWith('./');
  }
}

export function buildObjectStoragePublicUrl(objectPublicBase: string, storageKey: string): string {
  const base = objectPublicBase.replace(/\/$/, '');
  const key = storageKey.replace(/^\/+/, '');
  return `${base}/${key}`;
}

/**
 * Prefer the live object-storage public base when configured so API responses
 * never expose localhost / machine-local upload URLs. Local disk bytes must be
 * migrated with `pnpm --filter @modern-cms/api media:migrate-to-r2` first.
 */
export function resolveMediaPublicUrl(opts: {
  publicUrl: string;
  storageKey?: string | null;
  objectPublicBase?: string | null;
}): string {
  const base = opts.objectPublicBase?.trim().replace(/\/$/, '') || null;
  const key = opts.storageKey?.trim();
  if (base && key) {
    return buildObjectStoragePublicUrl(base, key);
  }
  return opts.publicUrl;
}
