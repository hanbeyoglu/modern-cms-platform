/** Backend list endpoints cap page size at 100 (@Max(100) on DTOs). */
export const API_MAX_PAGE_SIZE = 100;

/** Clamps list `limit` to the backend maximum. Returns undefined if invalid or omitted. */
export function clampApiLimit(limit?: number): number | undefined {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return undefined;
  return Math.min(Math.floor(limit), API_MAX_PAGE_SIZE);
}

export function appendLimitParam(params: URLSearchParams, limit?: number): void {
  const clamped = clampApiLimit(limit);
  if (clamped !== undefined) {
    params.set('limit', String(clamped));
  }
}
