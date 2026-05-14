import { Injectable } from '@nestjs/common';

/**
 * Query + document normalization for FTS and slug-friendly tokens.
 * PostgreSQL `simple` text search config handles case-folding for Latin scripts;
 * we additionally trim and collapse whitespace. Full accent stripping uses DB
 * `unaccent` only when enabled (see SPRINT15); here we keep characters stable.
 */
@Injectable()
export class SearchNormalizerService {
  normalizeQuery(raw: string | undefined | null): string {
    if (raw == null) return '';
    return raw
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 200);
  }

  /** Concatenate searchable fragments into one blob for tsvector indexing. */
  buildDocument(parts: Array<string | null | undefined>): string {
    const s = parts
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .join(' ')
      .trim();
    return s.slice(0, 32000);
  }
}
