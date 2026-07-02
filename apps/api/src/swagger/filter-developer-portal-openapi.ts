import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { enrichDeveloperPortalOpenApi } from './developer-portal/enrich-developer-portal-openapi';
import {
  DEVELOPER_PORTAL_TAG_GROUPS,
  SWAGGER_TAGS,
  TAG_DESCRIPTION_KEYS,
} from './swagger.constants';

const PUBLIC_PATH_PREFIX = '/public/';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Map public paths to frontend-facing Scalar tags (sidebar groups). */
function resolveDeveloperTag(path: string): string {
  if (path === '/public/home') return SWAGGER_TAGS.PUBLIC_HOMEPAGE;
  if (path === '/public/site-config') return SWAGGER_TAGS.PUBLIC_SITE_CONFIG;
  if (path === '/public/media-guidelines') return SWAGGER_TAGS.PUBLIC_MEDIA_GUIDELINES;
  if (path === '/public/sliders') return SWAGGER_TAGS.PUBLIC_SLIDERS;
  if (path.startsWith('/public/campaigns')) return SWAGGER_TAGS.PUBLIC_CAMPAIGNS;
  if (path.startsWith('/public/events')) return SWAGGER_TAGS.PUBLIC_EVENTS;
  if (path.startsWith('/public/stores')) return SWAGGER_TAGS.PUBLIC_STORES;
  if (path.startsWith('/public/pages')) return SWAGGER_TAGS.PUBLIC_PAGES;
  if (path.startsWith('/public/services')) return SWAGGER_TAGS.PUBLIC_SERVICES;
  if (path === '/public/cinema' || path.startsWith('/public/movie-sessions')) {
    return SWAGGER_TAGS.PUBLIC_MOVIES;
  }
  if (path === '/public/search') return SWAGGER_TAGS.PUBLIC_SEARCH;
  if (path === '/public/popups') return SWAGGER_TAGS.PUBLIC_POPUPS;
  return SWAGGER_TAGS.PUBLIC;
}

/**
 * Produce a frontend-only OpenAPI document for /developer.
 * Keeps /public/* paths only — no admin, auth, or internal CMS endpoints.
 */
export function filterOpenApiForDeveloperPortal(document: OpenAPIObject): OpenAPIObject {
  const cloned = structuredClone(document) as OpenAPIObject;
  const filteredPaths: NonNullable<OpenAPIObject['paths']> = {};
  const usedTags = new Set<string>();

  for (const [path, pathItem] of Object.entries(cloned.paths ?? {})) {
    if (!path.startsWith(PUBLIC_PATH_PREFIX)) continue;

    const item = structuredClone(pathItem);
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (!operation) continue;

      const tag = resolveDeveloperTag(path);
      operation.tags = [tag];
      usedTags.add(tag);
      operation.security = [];
    }

    filteredPaths[path] = item;
  }

  cloned.paths = filteredPaths;
  cloned.security = [];

  if (cloned.components?.securitySchemes) {
    delete cloned.components.securitySchemes;
  }

  cloned.info.title = 'developerPortal.api.title';
  cloned.info.description = 'developerPortal.api.description';

  const developerTags = [...usedTags].sort();
  cloned.tags = developerTags.map((name) => ({
    name,
    description: TAG_DESCRIPTION_KEYS[name] ?? name,
  }));

  (cloned as unknown as Record<string, unknown>)['x-tagGroups'] = DEVELOPER_PORTAL_TAG_GROUPS.map(
    (group) => ({
      name: group.nameKey,
      nameKey: group.nameKey,
      tags: group.tags.filter((tag) => usedTags.has(tag)),
    }),
  ).filter((group) => group.tags.length > 0);

  return enrichDeveloperPortalOpenApi(cloned);
}

/** Fail fast if admin paths leak into the developer portal spec. */
export function assertDeveloperPortalSpec(document: OpenAPIObject): void {
  const errors: string[] = [];

  for (const path of Object.keys(document.paths ?? {})) {
    if (!path.startsWith(PUBLIC_PATH_PREFIX)) {
      errors.push(`Non-public path in developer portal spec: ${path}`);
    }
  }

  const pathCount = Object.keys(document.paths ?? {}).length;
  if (pathCount === 0) {
    errors.push('Developer portal spec has no public paths');
  }

  if (document.components?.securitySchemes && Object.keys(document.components.securitySchemes).length > 0) {
    errors.push('Developer portal spec must not expose JWT security schemes');
  }

  if (errors.length > 0) {
    throw new Error(`Developer portal OpenAPI validation failed:\n- ${errors.join('\n- ')}`);
  }
}
