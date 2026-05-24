/** Routes that require a specific mall/location context (not tenant-wide "all"). */
export const MALL_SCOPED_PATH_PREFIXES = [
  '/services',
  '/mall-stores',
  '/events',
  '/campaigns',
  '/sliders',
  '/popups',
] as const;

export function isMallScopedPath(pathname: string): boolean {
  return MALL_SCOPED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
