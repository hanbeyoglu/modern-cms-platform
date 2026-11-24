export type TextReplacementSample = {
  entityType: string;
  sourceKey: string;
  field: string;
  before: string;
  after: string;
};

const PLACEHOLDER = 'Metrogarden';

/**
 * Replace Metrogarden place branding with the target mall display name.
 * Brand/store names (Zara, Apple, …) are left untouched.
 */
export function rebrandText(value: string | undefined, targetMallName: string): string | undefined {
  if (!value) return value;
  if (!/metrogarden/i.test(value)) return value;

  const target = targetMallName.trim() || 'Demo AVM';
  let out = value;

  // Longer phrases first
  out = out.replace(/Metrogarden\s+AVM/gi, target);
  out = out.replace(/Metrogarden[''`]da/gi, `${target}'da`);
  out = out.replace(/Metrogarden[''`]ın/gi, `${target}'ın`);
  out = out.replace(/Metrogarden[''`]in/gi, `${target}'in`);
  out = out.replace(/Metrogarden[''`]den/gi, `${target}'den`);
  out = out.replace(/Metrogarden[''`]dan/gi, `${target}'dan`);
  out = out.replace(/Metrogarden/gi, target);

  return out;
}

function snippetAroundChange(value: string, other: string, max = 160): string {
  if (value.length <= max) return value;
  let idx = 0;
  const limit = Math.min(value.length, other.length);
  while (idx < limit && value[idx] === other[idx]) idx += 1;
  const start = Math.max(0, idx - 40);
  const end = Math.min(value.length, start + max);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < value.length ? '…' : '';
  return `${prefix}${value.slice(start, end)}${suffix}`;
}

export function collectRebrandSamples(
  entityType: string,
  sourceKey: string,
  fields: Record<string, string | undefined>,
  targetMallName: string,
  into: TextReplacementSample[],
  limit = 40,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [field, raw] of Object.entries(fields)) {
    const after = rebrandText(raw, targetMallName);
    out[field] = after;
    if (
      into.length < limit &&
      typeof raw === 'string' &&
      typeof after === 'string' &&
      raw !== after
    ) {
      into.push({
        entityType,
        sourceKey,
        field,
        before: snippetAroundChange(raw, after),
        after: snippetAroundChange(after, raw),
      });
    }
  }
  return out;
}

export function countRebrandHits(data: unknown): number {
  let count = 0;
  const walk = (value: unknown) => {
    if (typeof value === 'string') {
      if (new RegExp(PLACEHOLDER, 'i').test(value)) count += 1;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) walk(nested);
    }
  };
  walk(data);
  return count;
}
