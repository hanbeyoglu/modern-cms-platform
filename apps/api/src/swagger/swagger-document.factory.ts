import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import {
  API_INTRO_KEY,
  OPENAPI_TAG_GROUPS,
  SWAGGER_TAGS,
  TAG_DESCRIPTION_KEYS,
} from './swagger.constants';

export interface BuildMetadata {
  version: string;
  gitSha: string;
  buildTime: string;
  generatedAt: string;
}

export function buildSwaggerConfig(meta: BuildMetadata) {
  const builder = new DocumentBuilder()
    .setTitle('api.title')
    .setDescription(API_INTRO_KEY)
    .setVersion(meta.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'security.jwt.description',
      },
      'JWT',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'security.apiKey.description',
      },
      'apiKey',
    )
    .addServer('/', 'Current host');

  for (const tagKey of Object.values(SWAGGER_TAGS)) {
    builder.addTag(tagKey, TAG_DESCRIPTION_KEYS[tagKey] ?? tagKey);
  }

  return builder.build();
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  let version = process.env.APP_VERSION ?? '0.0.0';
  let gitSha = process.env.APP_GIT_SHA ?? 'unknown';
  let buildTime = process.env.APP_BUILD_TIME ?? 'unknown';

  try {
    const config = app.get(ConfigService);
    version = config.get<string>('APP_VERSION') ?? version;
    gitSha = config.get<string>('APP_GIT_SHA') ?? gitSha;
    buildTime = config.get<string>('APP_BUILD_TIME') ?? buildTime;
  } catch {
    // Application context may not expose ConfigService in all bootstrap modes
  }

  const meta: BuildMetadata = {
    version,
    gitSha,
    buildTime,
    generatedAt: new Date().toISOString(),
  };

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig(meta), {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  document.openapi = '3.1.0';

  enrichOpenApiDocument(document, meta);

  return document;
}

export function enrichOpenApiDocument(document: OpenAPIObject, meta: BuildMetadata): void {
  const info = document.info as unknown as Record<string, unknown>;
  info['x-cms-version'] = meta.version;
  info['x-build-time'] = meta.buildTime;
  info['x-git-commit'] = meta.gitSha;
  info['x-generated-at'] = meta.generatedAt;
  info['x-openapi-version'] = document.openapi;

  (document as unknown as Record<string, unknown>)['x-tagGroups'] = OPENAPI_TAG_GROUPS.map(
    (group) => ({
      name: group.nameKey,
      nameKey: group.nameKey,
      tags: group.tags,
    }),
  );

  addPublicSdkCodeSamples(document);
  validateOpenApiDocument(document);
}

function addPublicSdkCodeSamples(document: OpenAPIObject): void {
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!path.startsWith('/public/')) continue;

    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (!operation) continue;

      const sdkMethod = inferSdkMethod(path, method);
      if (!sdkMethod) continue;

      const op = operation as unknown as Record<string, unknown>;
      const existing = (op['x-codeSamples'] as unknown[]) ?? [];
      op['x-codeSamples'] = [
        ...existing,
        {
          lang: 'TypeScript',
          label: 'CmsPublicClient',
          source: buildSdkSample(sdkMethod, path),
        },
      ];
    }
  }
}

function inferSdkMethod(path: string, method: string): string | null {
  if (method !== 'get') return null;
  const map: Record<string, string> = {
    '/public/site-config': 'getSiteConfig',
    '/public/media-guidelines': 'getMediaGuidelines',
    '/public/home': 'getHome',
    '/public/sliders': 'getSliders',
    '/public/events': 'getEvents',
    '/public/campaigns': 'getCampaigns',
    '/public/stores': 'getStores',
    '/public/cinema': 'getCinemas',
    '/public/movie-sessions': 'getMovieSessions',
    '/public/popups': 'getPopups',
    '/public/services': 'getServices',
    '/public/search': 'search',
  };
  if (map[path]) return map[path];
  if (path.match(/^\/public\/events\/{slug}$/)) return 'getEventBySlug';
  if (path.match(/^\/public\/campaigns\/{slug}$/)) return 'getCampaignBySlug';
  if (path.match(/^\/public\/stores\/{slug}$/)) return 'getStoreBySlug';
  if (path.match(/^\/public\/pages\/{slug}$/)) return 'getPageBySlug';
  if (path.match(/^\/public\/services\/{id}$/)) return 'getServiceById';
  return null;
}

function buildSdkSample(method: string, path: string): string {
  const slugMatch = path.match(/\{(\w+)\}/);
  const slugArg = slugMatch ? `\n  '${slugMatch[1]}': 'example-slug',` : '';
  const opts =
    method === 'getSliders' || method === 'getPopups'
      ? '{ locale: "tr", channel: "WEB" }'
      : method === 'search'
        ? '{ q: "zara", locale: "tr" }'
        : slugMatch
          ? `{${slugArg}\n  locale: "tr",\n}`
          : '{ locale: "tr" }';

  return `import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'pk_live_••••••••••••••••••••••••••••••••',
  tenantId: 'your-tenant-id',
  mallId: 'your-mall-id',
  defaultLocale: 'tr',
});

const result = await cms.${method}(${opts});`;
}

/** Fail fast on broken or empty OpenAPI output. */
export function validateOpenApiDocument(document: OpenAPIObject): void {
  const errors: string[] = [];

  if (!document.openapi?.startsWith('3.')) {
    errors.push(`Invalid OpenAPI version: ${document.openapi}`);
  }

  const paths = Object.keys(document.paths ?? {});
  if (paths.length === 0) {
    errors.push('OpenAPI document has no paths');
  }

  let undocumented = 0;
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = pathItem[method];
      if (!op) continue;
      if (!op.summary && !op.description) {
        undocumented += 1;
      }
      if (!op.responses || Object.keys(op.responses).length === 0) {
        errors.push(`Operation ${method.toUpperCase()} missing responses`);
      }
    }
  }

  if (undocumented > 0) {
    errors.push(`${undocumented} operation(s) missing summary/description`);
  }

  if (errors.length > 0) {
    throw new Error(`OpenAPI validation failed:\n- ${errors.join('\n- ')}`);
  }
}
