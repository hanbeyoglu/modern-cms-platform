import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';

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

/** @deprecated Use assertScheduledAtInFuture from publish-workflow */
export function assertStartAtWhenScheduled(
  status: string,
  startAt: string | Date | null | undefined,
): void {
  if (status !== 'SCHEDULED') return;
  if (startAt === undefined || startAt === null || startAt === '') {
    throw new UnprocessableEntityException('startAt is required when status is SCHEDULED');
  }
}

/** @deprecated Use assertScheduledAtInFuture from publish-workflow */
export function assertPublishAtWhenScheduled(
  status: string,
  publishAt: string | Date | null | undefined,
): void {
  if (status !== 'SCHEDULED') return;
  if (publishAt === undefined || publishAt === null || publishAt === '') {
    throw new UnprocessableEntityException('publishAt is required when status is SCHEDULED');
  }
}
