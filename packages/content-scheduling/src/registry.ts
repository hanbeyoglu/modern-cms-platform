import type { ScheduledEntityKind } from './tick.js';

/** Declarative map for observability / future extensions (worker metrics, admin hints). */
export const SCHEDULER_REGISTRY: Record<
  ScheduledEntityKind,
  { publishField: string; unpublishField: string; statusEnum: string }
> = {
  slider: { publishField: 'startAt', unpublishField: 'endAt', statusEnum: 'SliderStatus' },
  event: { publishField: 'startAt', unpublishField: 'endAt', statusEnum: 'ContentStatus' },
  campaign: { publishField: 'startAt', unpublishField: 'endAt', statusEnum: 'ContentStatus' },
  page: { publishField: 'publishAt', unpublishField: 'unpublishAt', statusEnum: 'PageStatus' },
  popup: { publishField: 'startAt', unpublishField: 'endAt', statusEnum: 'PopupStatus' },
};
