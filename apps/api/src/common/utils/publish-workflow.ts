import { UnprocessableEntityException } from '@nestjs/common';
import { validateStartBeforeEnd } from './content-validation';

export type WorkflowStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export function toScheduleDate(value: string | Date | null | undefined): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** SCHEDULED content must have a future publish/start instant. */
export function assertScheduledAtInFuture(
  status: string,
  scheduleAt: string | Date | null | undefined,
  fieldName: 'publishAt' | 'publishStartAt' | 'startAt',
  now: Date = new Date(),
): void {
  if (status !== 'SCHEDULED') return;
  const at = toScheduleDate(scheduleAt);
  if (!at) {
    throw new UnprocessableEntityException(`${fieldName} is required when status is SCHEDULED`);
  }
  if (at.getTime() <= now.getTime()) {
    throw new UnprocessableEntityException(
      `${fieldName} must be in the future when status is SCHEDULED`,
    );
  }
}

export function assertPublishedHasScheduleAt(
  status: string,
  scheduleAt: Date | null,
  fieldName: 'publishAt' | 'publishStartAt' | 'startAt',
): void {
  if (status !== 'PUBLISHED') return;
  if (!scheduleAt) {
    throw new UnprocessableEntityException(`${fieldName} is required when status is PUBLISHED`);
  }
}

export type PageScheduleInput = {
  status: string;
  publishAt?: string | Date | null;
  unpublishAt?: string | Date | null;
};

export type ResolvedPageSchedule = {
  publishAt: Date | null;
  unpublishAt: Date | null;
};

export function resolvePageSchedule(
  input: PageScheduleInput,
  now: Date = new Date(),
): ResolvedPageSchedule {
  const { status } = input;
  let publishAt = toScheduleDate(input.publishAt);
  let unpublishAt = toScheduleDate(input.unpublishAt);

  if (status === 'SCHEDULED') {
    assertScheduledAtInFuture(status, publishAt, 'publishAt', now);
  } else if (status === 'PUBLISHED') {
    if (!publishAt) publishAt = now;
  } else if (status === 'ARCHIVED') {
    if (!unpublishAt) unpublishAt = now;
  }

  assertPublishedHasScheduleAt(status, publishAt, 'publishAt');
  validateStartBeforeEnd(publishAt, unpublishAt);

  return { publishAt, unpublishAt };
}

export type ContentPublishScheduleInput = {
  status: string;
  publishStartAt?: string | Date | null;
  publishEndAt?: string | Date | null;
};

export type ResolvedContentPublishSchedule = {
  publishStartAt: Date | null;
  publishEndAt: Date | null;
};

/** Campaign / Event — publish window controls CMS & public visibility. */
export function resolveContentPublishSchedule(
  input: ContentPublishScheduleInput,
  now: Date = new Date(),
): ResolvedContentPublishSchedule {
  const { status } = input;
  let publishStartAt = toScheduleDate(input.publishStartAt);
  let publishEndAt = toScheduleDate(input.publishEndAt);

  if (status === 'SCHEDULED') {
    assertScheduledAtInFuture(status, publishStartAt, 'publishStartAt', now);
  } else if (status === 'PUBLISHED') {
    if (!publishStartAt) publishStartAt = now;
  } else if (status === 'ARCHIVED') {
    if (!publishEndAt) publishEndAt = now;
  }

  assertPublishedHasScheduleAt(status, publishStartAt, 'publishStartAt');
  validateStartBeforeEnd(publishStartAt, publishEndAt);

  return { publishStartAt, publishEndAt };
}

export type RangeScheduleInput = {
  status: string;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
};

export type ResolvedRangeSchedule = {
  startAt: Date | null;
  endAt: Date | null;
};

/** Slider / Event / Campaign — `startAt` is the scheduler publish trigger. */
export function resolveRangeSchedule(
  input: RangeScheduleInput,
  now: Date = new Date(),
): ResolvedRangeSchedule {
  const { status } = input;
  let startAt = toScheduleDate(input.startAt);
  let endAt = toScheduleDate(input.endAt);

  if (status === 'SCHEDULED') {
    assertScheduledAtInFuture(status, startAt, 'startAt', now);
  } else if (status === 'PUBLISHED') {
    if (!startAt) startAt = now;
  } else if (status === 'ARCHIVED') {
    if (!endAt) endAt = now;
  }

  assertPublishedHasScheduleAt(status, startAt, 'startAt');
  validateStartBeforeEnd(startAt, endAt);

  return { startAt, endAt };
}
