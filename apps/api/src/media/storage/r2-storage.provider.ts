import { Injectable } from '@nestjs/common';
import { R2Service } from '../../r2/r2.service';
import { StorageProvider, type UploadInput, type UploadResult } from './storage.provider';

@Injectable()
export class R2StorageProvider extends StorageProvider {
  constructor(private readonly r2: R2Service) {
    super();
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const result = await this.r2.upload({
      key: input.key,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    return { key: result.key, publicUrl: result.url };
  }

  async delete(key: string): Promise<void> {
    await this.r2.delete(key);
  }

  getPublicUrl(key: string): string {
    return this.r2.getPublicUrl(key);
  }
}
