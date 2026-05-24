export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePage(str: string | undefined, defaultVal = 1): number {
  if (!str) return defaultVal;
  const n = parseInt(str, 10);
  if (Number.isNaN(n) || n < 1) return defaultVal;
  return n;
}

export function parseLimit(str: string | undefined, defaultVal: number, max: number): number {
  if (!str) return defaultVal;
  const n = parseInt(str, 10);
  if (Number.isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

export function parsePagination(
  pageStr: string | undefined,
  limitStr: string | undefined,
  defaultLimit: number,
  maxLimit: number,
): ParsedPagination {
  const limit = parseLimit(limitStr, defaultLimit, maxLimit);
  const page = parsePage(pageStr);
  return { page, limit, skip: (page - 1) * limit };
}

export interface PaginatedItems<T> {
  items: T[];
  total: number;
}
