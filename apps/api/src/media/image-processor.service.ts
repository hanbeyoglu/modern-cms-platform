import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  size: number;
}

@Injectable()
export class ImageProcessorService {
  /**
   * Raster images are converted to WebP. SVG is stored as-is (no sharp conversion).
   */
  async processForUpload(buffer: Buffer, mimeType: string): Promise<ProcessedImage> {
    if (mimeType === 'image/svg+xml') {
      return {
        buffer,
        mimeType,
        extension: 'svg',
        width: null,
        height: null,
        size: buffer.length,
      };
    }

    const pipeline = sharp(buffer, { animated: mimeType === 'image/gif' });
    const metadata = await pipeline.metadata();
    const webpBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
    const webpMeta = await sharp(webpBuffer).metadata();

    return {
      buffer: webpBuffer,
      mimeType: 'image/webp',
      extension: 'webp',
      width: webpMeta.width ?? metadata.width ?? null,
      height: webpMeta.height ?? metadata.height ?? null,
      size: webpBuffer.length,
    };
  }
}
