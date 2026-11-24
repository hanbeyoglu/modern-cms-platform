import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

/** Allow only the formatting emitted by the content editor. Keep legacy plain text intact. */
export function sanitizeRichText(value: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(value)) return value;
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 's', 'strike', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'span', 'hr', 'pre', 'code'],
    allowedAttributes: { a: ['href', 'target', 'rel'], span: ['style'], p: ['style'], h2: ['style'], h3: ['style'], ol: ['start'] },
    allowedStyles: {
      '*': { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/i], 'text-align': [/^(left|center|right|justify)$/] },
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: { a: (_tag, attributes) => ({ tagName: 'a', attribs: { ...attributes, target: '_blank', rel: 'noopener noreferrer' } }) },
  }).trim();
}

/** Limit rich text handling to fields that have a rich editor. */
export function sanitizeLocalizedRichText(entityType: string, field: string, value: string): string {
  const richField = (entityType === 'CAMPAIGN' && ['description', 'terms'].includes(field)) ||
    (['EVENT', 'GLOBAL_STORE', 'STORE_CATEGORY', 'MALL_STORE', 'STORE', 'MOVIE', 'CINEMA', 'SLIDER_ITEM', 'SLIDER', 'SERVICE', 'LOCATION', 'POPUP'].includes(entityType) && ['description', 'localDescription'].includes(field));
  return richField ? sanitizeRichText(value) : value;
}

/** Sanitize rich descriptions at the DTO boundary without coercing invalid types. */
export function RichText() {
  return Transform(({ value }: { value: unknown }) => typeof value === 'string' ? sanitizeRichText(value) : value);
}
