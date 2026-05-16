import type { ContentChannel } from './content-channels';
import type { SliderPlacementType } from './api/sliders';

export const ENTITY_SLIDER_PLACEMENTS: SliderPlacementType[] = [
  'CAMPAIGN',
  'EVENT',
  'STORE',
  'LOCATION',
];

export function getSliderCreateBlocker(opts: {
  tenantId: string | null;
  canCreate: boolean;
  title: string;
  placementType: SliderPlacementType;
  linkedEntityId: string;
  channels: ContentChannel[];
  mallId?: string | null;
}): string | null {
  if (!opts.tenantId) return 'Önce tenant seçmelisiniz';
  if (!opts.canCreate) return 'Slider oluşturma yetkiniz yok';
  if (opts.placementType === 'STORE' && !opts.mallId) return 'Önce lokasyon seçmelisiniz';
  if (!opts.title.trim()) return 'Zorunlu alanları doldurun';
  if (!opts.placementType) return 'Zorunlu alanları doldurun';
  if (!opts.channels.length) return 'Zorunlu alanları doldurun';
  if (
    ENTITY_SLIDER_PLACEMENTS.includes(opts.placementType) &&
    !opts.linkedEntityId.trim()
  ) {
    return 'Zorunlu alanları doldurun';
  }
  return null;
}

export function getSliderGroupSaveBlocker(opts: {
  tenantId: string | null;
  canUpdate: boolean;
  title: string;
  placementType: SliderPlacementType;
  linkedEntityId: string;
  channels: ContentChannel[];
}): string | null {
  if (!opts.tenantId) return 'Önce tenant seçmelisiniz';
  if (!opts.canUpdate) return 'Slider düzenleme yetkiniz yok';
  if (!opts.title.trim()) return 'Zorunlu alanları doldurun';
  if (!opts.channels.length) return 'Zorunlu alanları doldurun';
  if (
    ENTITY_SLIDER_PLACEMENTS.includes(opts.placementType) &&
    !opts.linkedEntityId.trim()
  ) {
    return 'Zorunlu alanları doldurun';
  }
  return null;
}

export function getSliderItemSaveBlocker(opts: {
  tenantId: string | null;
  canUpdate: boolean;
  desktopMediaId: string;
  mobileMediaId: string;
}): string | null {
  if (!opts.tenantId) return 'Önce tenant seçmelisiniz';
  if (!opts.canUpdate) return 'Slider düzenleme yetkiniz yok';
  if (!opts.desktopMediaId && !opts.mobileMediaId) {
    return 'Zorunlu alanları doldurun';
  }
  return null;
}
