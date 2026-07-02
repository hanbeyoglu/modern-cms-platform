import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

const TENANT_HEADER_KEY = 'header.tenant-id.description';
const MALL_HEADER_KEY = 'header.mall-id.description';
const LOCALE_QUERY_KEY = 'query.locale.description';
const CHANNEL_QUERY_KEY = 'query.channel.description';

/** Standard admin API headers: JWT + tenant + optional mall. */
export function ApiAdminContext() {
  return applyDecorators(
    ApiBearerAuth('JWT'),
    ApiHeader({
      name: 'x-tenant-id',
      description: TENANT_HEADER_KEY,
      required: true,
      schema: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    }),
    ApiHeader({
      name: 'x-mall-id',
      description: MALL_HEADER_KEY,
      required: false,
      schema: { type: 'string', format: 'uuid', example: '660e8400-e29b-41d4-a716-446655440001' },
    }),
  );
}

/** Public API headers — no JWT. */
export function ApiPublicContext() {
  return applyDecorators(
    ApiHeader({
      name: 'x-tenant-id',
      description: TENANT_HEADER_KEY,
      required: true,
      schema: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    }),
    ApiHeader({
      name: 'x-mall-id',
      description: MALL_HEADER_KEY,
      required: false,
      schema: { type: 'string', format: 'uuid', example: '660e8400-e29b-41d4-a716-446655440001' },
    }),
  );
}

export function ApiLocaleQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'locale',
      required: false,
      description: LOCALE_QUERY_KEY,
      schema: { type: 'string', example: 'tr' },
    }),
  );
}

export function ApiChannelQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'channel',
      required: false,
      description: CHANNEL_QUERY_KEY,
      schema: { type: 'string', enum: ['WEB', 'MOBILE', 'KIOSK', 'DIGITAL_SIGNAGE'], example: 'WEB' },
    }),
  );
}

export function ApiPaginationQuery(defaultLimit = 20, maxLimit = 50) {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      description: 'query.page.description',
      schema: { type: 'integer', minimum: 1, default: 1, example: 1 },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'query.limit.description',
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: maxLimit,
        default: defaultLimit,
        example: defaultLimit,
      },
    }),
  );
}

export function ApiUuidParam(name: string, descriptionKey = 'common.param.uuid') {
  return applyDecorators(
    ApiParam({
      name,
      description: descriptionKey,
      schema: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    }),
  );
}

export function ApiSlugParam(name = 'slug', descriptionKey = 'common.param.slug') {
  return applyDecorators(
    ApiParam({ name, description: descriptionKey, schema: { type: 'string', example: 'summer-sale-2026' } }),
  );
}

export function ApiStandardErrors() {
  return applyDecorators(
    ApiResponse({ status: 401, description: 'errors.401' }),
    ApiResponse({ status: 403, description: 'errors.403' }),
    ApiResponse({ status: 404, description: 'errors.404' }),
    ApiResponse({ status: 422, description: 'errors.422' }),
  );
}

export interface ApiEndpointKeyOptions {
  summary: string;
  description?: string;
  permissions?: string[];
  /** Tag translation keys e.g. SWAGGER_TAGS.MEDIA */
  related?: string[];
  /** Mark endpoint as deprecated in OpenAPI. */
  deprecated?: boolean;
}

/** Document an admin endpoint using i18n keys. */
export function ApiAdminOperation(options: ApiEndpointKeyOptions) {
  const descParts: string[] = [];
  if (options.description) descParts.push(options.description);
  if (options.permissions?.length) {
    descParts.push(`common.permissions.label:${options.permissions.join('`, `')}`);
  }
  if (options.related?.length) {
    descParts.push(`common.related.label:${options.related.join(', ')}`);
  }

  const decorators = [
    ApiOperation({
      summary: options.summary,
      description: descParts.length ? descParts.join('\n\n') : undefined,
      deprecated: options.deprecated,
    }),
    ApiExtension('x-i18n-summary', options.summary),
    ApiStandardErrors(),
  ];
  if (options.permissions?.length) {
    decorators.push(ApiExtension('x-permissions', options.permissions));
  }
  if (options.related?.length) {
    decorators.push(ApiExtension('x-related-tags', options.related));
  }
  return applyDecorators(...decorators);
}

/** Document a public API endpoint using i18n keys. */
export function ApiPublicOperation(options: ApiEndpointKeyOptions & { mallRequired?: boolean }) {
  const descParts: string[] = [];
  if (options.description) descParts.push(options.description);
  if (options.mallRequired) descParts.push('common.requires.mallHeader');
  if (options.related?.length) {
    descParts.push(`common.related.label:${options.related.join(', ')}`);
  }

  const decorators = [
    ApiOperation({
      summary: options.summary,
      description: descParts.length ? descParts.join('\n\n') : undefined,
    }),
    ApiExtension('x-i18n-summary', options.summary),
    ApiResponse({ status: 400, description: 'errors.400' }),
    ApiResponse({ status: 404, description: 'errors.404' }),
  ];
  if (options.related?.length) {
    decorators.push(ApiExtension('x-related-tags', options.related));
  }
  return applyDecorators(...decorators);
}

/** Shorthand for @ApiResponse with description key. */
export function ApiKeyResponse(status: number, descriptionKey: string) {
  return applyDecorators(ApiResponse({ status, description: descriptionKey }));
}

/** @ApiOperation wrapper using summary key. */
export function ApiKeyOperation(summary: string, description?: string) {
  return applyDecorators(
    ApiOperation({ summary, description }),
    ApiExtension('x-i18n-summary', summary),
  );
}
