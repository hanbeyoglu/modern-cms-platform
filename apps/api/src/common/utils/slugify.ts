/**
 * URL-safe slug from display name (ASCII fallback for non-latin chars).
 */
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'item';
}
