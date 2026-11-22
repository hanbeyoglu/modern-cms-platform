import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getObjectStoragePublicBase } from './object-storage.config';
import { resolveMediaPublicUrl } from './media-url';

@Injectable()
export class MediaUrlResolver {
  private readonly objectPublicBase: string | null;

  constructor(config: ConfigService) {
    this.objectPublicBase = getObjectStoragePublicBase(config);
  }

  /** Browser-reachable URL for admin + public responses. */
  resolve(publicUrl: string, storageKey?: string | null): string {
    return resolveMediaPublicUrl({
      publicUrl,
      storageKey,
      objectPublicBase: this.objectPublicBase,
    });
  }

  get objectStorageEnabled(): boolean {
    return Boolean(this.objectPublicBase);
  }
}
