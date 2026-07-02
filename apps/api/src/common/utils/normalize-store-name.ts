/**
 * Normalize store name for duplicate detection (trim, lowercase, Turkish-safe, collapse spaces).
 */
export function normalizeStoreName(input: string): string {
  const collapsed = input
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return collapsed.length > 0 ? collapsed : 'store';
}
