import type { ScheduledEntityKind } from './tick.js';

/** Declarative map for observability / future extensions (worker metrics, admin hints). */
export const SCHEDULER_REGISTRY: Record<
  ScheduledEntityKind,
  { publishField: string; unpublishField: string; statusEnum: string }
> = {
  slider: { publishField: 'startAt', unpublishField: 'endAt', statusEnum: 'SliderStatus' },
  event: { publishField: 'publishStartAt', unpublishField: 'publishEndAt', statusEnum: 'ContentStatus' },
  campaign: { publishField: 'publishStartAt', unpublishField: 'publishEndAt', statusEnum: 'ContentStatus' },
  page: { publishField: 'publishAt', unpublishField: 'unpublishAt', statusEnum: 'PageStatus' },
  popup: { publishField: 'startAt', unpublishField: 'endAt', statusEnum: 'PopupStatus' },
};
