import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { BadRequestException, Logger } from '@nestjs/common';
import { StorageProvider, UploadInput, UploadResult } from './storage.provider';

export interface LocalStorageConfig {
  storageRoot: string;
  baseUrl: string;
}

export class LocalStorageProvider extends StorageProvider {
  readonly kind = 'local' as const;
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(config: LocalStorageConfig) {
    super();
    this.root = config.storageRoot;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const fullPath = this.safePath(input.key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.buffer);
    this.logger.debug(`Stored file: ${fullPath}`);
    return { key: input.key, publicUrl: this.getPublicUrl(input.key) };
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.safePath(key);
    try {
      await unlink(fullPath);
      this.logger.debug(`Deleted file: ${fullPath}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
      // already gone — safe to ignore
    }
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
  }

  ensureRootExists(): void {
    if (!existsSync(this.root)) {
      // synchronous at startup only
      mkdirSync(this.root, { recursive: true });
    }
  }

  /**
   * Reject keys that could escape the configured storage directory.
   */
  private safePath(key: string): string {
    const root = path.resolve(this.root);
    const fullPath = path.resolve(root, key);
    if (!key || key.includes('\\') || path.isAbsolute(key) || !fullPath.startsWith(`${root}${path.sep}`)) {
      throw new BadRequestException('Geçersiz medya dosyası yolu');
    }
    return fullPath;
  }
}
