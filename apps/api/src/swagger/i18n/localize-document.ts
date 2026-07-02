import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { PortalLocale } from './portal-locales';
import { PORTAL_LOCALES } from './portal-locales';
import { getLocaleDictionary, getAllSearchTermsForKey } from '../locales';

/** Replace translation keys in an OpenAPI document with localized strings. */
export function localizeOpenApiDocument(
  document: OpenAPIObject,
  locale: PortalLocale,
): OpenAPIObject {
  const dict = getLocaleDictionary(locale);
  const cloned = structuredClone(document) as OpenAPIObject;

  translateNode(cloned, dict, locale);

  const isDeveloperPortal = Boolean(
    (cloned.info as unknown as Record<string, unknown> | undefined)?.['x-portal-developer'],
  );

  if (cloned.info) {
    cloned.info.title = translateValue(cloned.info.title, dict);
    if (isDeveloperPortal) {
      cloned.info.description = translateValue(cloned.info.description ?? '', dict);
    } else {
      cloned.info.description = translateValue(dict['intro.summary'] ?? cloned.info.description ?? '', dict);
    }
  }

  translateTags(cloned, dict);
  translateTagGroups(cloned, dict);
  translateSecuritySchemes(cloned, dict);
  addCrossLanguageSearch(cloned);

  if (isDeveloperPortal) {
    appendDeveloperEndpointGuides(cloned, dict);
  }

  const info = cloned.info as unknown as Record<string, unknown>;
  info['x-portal-locale'] = locale;

  return cloned;
}

export function localizeAllDocuments(
  base: OpenAPIObject,
): Record<PortalLocale, OpenAPIObject> {
  const out = {} as Record<PortalLocale, OpenAPIObject>;
  for (const locale of PORTAL_LOCALES) {
    out[locale] = localizeOpenApiDocument(base, locale);
  }
  return out;
}

function translateTags(document: OpenAPIObject, dict: Record<string, string>): void {
  if (!document.tags) return;
  document.tags = document.tags.map((tag) => ({
    ...tag,
    name: translateTagName(tag.name, dict),
    description: tag.description ? translateValue(tag.description, dict) : tag.description,
  }));
}

function translateTagGroups(document: OpenAPIObject, dict: Record<string, string>): void {
  const groups = (document as unknown as Record<string, unknown>)['x-tagGroups'] as
    | Array<{ name: string; nameKey?: string; tags: string[] }>
    | undefined;
  if (!groups) return;

  (document as unknown as Record<string, unknown>)['x-tagGroups'] = groups.map((group) => ({
    name: translateValue(group.nameKey ?? group.name, dict),
    tags: group.tags.map((t) => translateTagName(t, dict)),
  }));
}

function translateSecuritySchemes(document: OpenAPIObject, dict: Record<string, string>): void {
  const schemes = document.components?.securitySchemes;
  if (!schemes) return;
  for (const scheme of Object.values(schemes)) {
    if (scheme && 'description' in scheme && typeof scheme.description === 'string') {
      scheme.description = translateValue(scheme.description, dict);
    }
  }
}

function translateTagName(name: string, dict: Record<string, string>): string {
  if (dict[name]) return dict[name];
  const tagKey = name.startsWith('tags.') ? name : `tags.${camelToKey(name)}`;
  return dict[tagKey] ?? dict[name] ?? name;
}

function camelToKey(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/([a-z])([A-Z])/g, '$1.$2')
    .toLowerCase()
    .replace(/\s/g, '-');
}

function translateNode(node: unknown, dict: Record<string, string>, locale: PortalLocale): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) translateNode(item, dict, locale);
    return;
  }

  const obj = node as Record<string, unknown>;

  for (const field of ['summary', 'description'] as const) {
    if (typeof obj[field] === 'string') {
      obj[field] = translateValue(obj[field] as string, dict);
    }
  }

  if (obj.responses && typeof obj.responses === 'object') {
    for (const response of Object.values(obj.responses as Record<string, unknown>)) {
      if (response && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        if (typeof r.description === 'string') {
          r.description = translateValue(r.description, dict);
        }
      }
    }
  }

  if (obj.parameters && Array.isArray(obj.parameters)) {
    for (const param of obj.parameters) {
      if (param && typeof param === 'object' && typeof (param as { description?: string }).description === 'string') {
        (param as { description: string }).description = translateValue(
          (param as { description: string }).description,
          dict,
        );
      }
    }
  }

  if (obj.headers && typeof obj.headers === 'object') {
    for (const header of Object.values(obj.headers as Record<string, unknown>)) {
      if (header && typeof header === 'object' && typeof (header as { description?: string }).description === 'string') {
        (header as { description: string }).description = translateValue(
          (header as { description: string }).description,
          dict,
        );
      }
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') translateNode(value, dict, locale);
  }
}

function translateValue(text: string, dict: Record<string, string>): string {
  if (dict[text]) return dict[text];

  if (text.startsWith('common.permissions.label:')) {
    const perms = text.slice('common.permissions.label:'.length);
    const label = dict['common.permissions.label'] ?? '**Permissions:**';
    return `${label} \`${perms}\``;
  }

  if (text.startsWith('common.related.label:')) {
    const related = text.slice('common.related.label:'.length);
    const label = dict['common.related.label'] ?? '**Related:**';
    const translated = related
      .split(',')
      .map((t) => dict[t.trim()] ?? t.trim())
      .join(', ');
    return `${label} ${translated}`;
  }

  let result = text;
  result = result.replace(/\*\*Permissions:\*\* `([^`]+)`/g, (_m, perms) => {
    const label = dict['common.permissions.label'] ?? '**Permissions:**';
    return `${label} \`${perms}\``;
  });
  result = result.replace(/\*\*Related:\*\* ([^\n]+)/g, (_m, related) => {
    const label = dict['common.related.label'] ?? '**Related:**';
    return `${label} ${related}`;
  });
  result = result.replace(/\*\*Requires\*\* `x-mall-id` header\./g, () => {
    return dict['common.requires.mallHeader'] ?? '**Requires** `x-mall-id` header.';
  });

  if (dict[result]) return dict[result];
  return result;
}

/** Inject cross-language search terms so "campaign" and "kampanya" both match. */
function addCrossLanguageSearch(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = pathItem[method];
      if (!op) continue;

      const summaryKey = (op as unknown as Record<string, unknown>)['x-i18n-summary'] as string | undefined;
      const key = summaryKey ?? (op.summary && isLikelyKey(op.summary) ? op.summary : undefined);
      if (!key) continue;

      const searchTerms = getAllSearchTermsForKey(key);
      if (searchTerms.length === 0) continue;

      (op as unknown as Record<string, unknown>)['x-search-keywords'] = searchTerms;

      const suffix = `\n\n<!-- i18n-search: ${searchTerms.join(', ')} -->`;
      if (!op.description?.includes('i18n-search:')) {
        op.description = (op.description ?? '') + suffix;
      }
    }
  }
}

function isLikelyKey(value: string): boolean {
  return /^[a-z][a-z0-9_.]+$/.test(value) && value.includes('.');
}

/** Append localized integration guides to developer portal operation descriptions. */
function appendDeveloperEndpointGuides(
  document: OpenAPIObject,
  dict: Record<string, string>,
): void {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = pathItem[method];
      if (!op) continue;

      const guideKey = (op as unknown as Record<string, unknown>)['x-dev-guide-key'] as
        | string
        | undefined;
      if (!guideKey) continue;

      const guide = dict[guideKey];
      if (!guide) continue;

      const marker = '## Integration guide';
      const markerTr = '## Entegrasyon rehberi';
      const markerRu = '## Руководство';
      const base = op.description ?? '';
      if (base.includes(marker) || base.includes(markerTr) || base.includes(markerRu)) continue;

      op.description = base ? `${base}\n\n---\n\n${guide}` : guide;
    }
  }
}

