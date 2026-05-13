import { BadRequestException } from '@nestjs/common';

export function validateStartBeforeEnd(
  startAt?: string | Date | null,
  endAt?: string | Date | null,
): void {
  if (!startAt || !endAt) return;
  const s = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const e = typeof endAt === 'string' ? new Date(endAt) : endAt;
  if (s >= e) {
    throw new BadRequestException('startAt must be before endAt');
  }
}

export function assertOptionalHttpUrl(linkUrl?: string | null): void {
  if (linkUrl === undefined || linkUrl === null || linkUrl.trim() === '') return;
  try {
    const u = new URL(linkUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new BadRequestException('linkUrl must be an http(s) URL');
    }
  } catch {
    throw new BadRequestException('linkUrl must be a valid URL');
  }
}
