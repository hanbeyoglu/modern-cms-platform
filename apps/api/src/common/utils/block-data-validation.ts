import { BadRequestException } from '@nestjs/common';

export type BlockType =
  | 'hero'
  | 'rich-text'
  | 'image'
  | 'gallery'
  | 'video'
  | 'cta'
  | 'faq'
  | 'map'
  | 'store-list'
  | 'event-list'
  | 'campaign-list'
  | 'custom-html';

export const SUPPORTED_BLOCK_TYPES: BlockType[] = [
  'hero',
  'rich-text',
  'image',
  'gallery',
  'video',
  'cta',
  'faq',
  'map',
  'store-list',
  'event-list',
  'campaign-list',
  'custom-html',
];

function assertField(
  data: Record<string, unknown>,
  field: string,
  blockType: string,
): void {
  if (!data[field]) {
    throw new BadRequestException(
      `Block type "${blockType}" requires field "${field}"`,
    );
  }
}

function assertArrayField(
  data: Record<string, unknown>,
  field: string,
  blockType: string,
): void {
  if (!Array.isArray(data[field]) || (data[field] as unknown[]).length === 0) {
    throw new BadRequestException(
      `Block type "${blockType}" requires non-empty array field "${field}"`,
    );
  }
}

export function validateBlockData(
  blockType: string,
  data: Record<string, unknown>,
): void {
  if (!SUPPORTED_BLOCK_TYPES.includes(blockType as BlockType)) {
    throw new BadRequestException(
      `Unsupported block type "${blockType}". Supported: ${SUPPORTED_BLOCK_TYPES.join(', ')}`,
    );
  }

  switch (blockType as BlockType) {
    case 'rich-text':
      if (!data['html'] && !data['text']) {
        throw new BadRequestException(
          'Block type "rich-text" requires either "html" or "text" field',
        );
      }
      break;

    case 'image':
      assertField(data, 'mediaId', 'image');
      break;

    case 'gallery':
      assertArrayField(data, 'mediaIds', 'gallery');
      break;

    case 'video':
      if (!data['url'] && !data['mediaId']) {
        throw new BadRequestException(
          'Block type "video" requires either "url" or "mediaId" field',
        );
      }
      break;

    case 'cta':
      assertField(data, 'title', 'cta');
      break;

    case 'faq': {
      assertArrayField(data, 'items', 'faq');
      const items = data['items'] as unknown[];
      for (const item of items) {
        if (
          typeof item !== 'object' ||
          item === null ||
          !('question' in item) ||
          !('answer' in item)
        ) {
          throw new BadRequestException(
            'Block type "faq" items must have "question" and "answer" fields',
          );
        }
      }
      break;
    }

    case 'map':
      if (
        !data['address'] &&
        (data['latitude'] === undefined || data['longitude'] === undefined)
      ) {
        throw new BadRequestException(
          'Block type "map" requires "address" or both "latitude" and "longitude"',
        );
      }
      break;

    case 'custom-html':
      assertField(data, 'html', 'custom-html');
      break;

    // hero, store-list, event-list, campaign-list — all fields optional
    default:
      break;
  }
}
