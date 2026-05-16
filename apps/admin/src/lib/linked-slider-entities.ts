import type { SliderLinkedEntityType, SliderPlacementType } from './api/sliders';

export type LinkedSliderEntityKind = SliderLinkedEntityType;

export type LinkedSliderEntityConfig = {
  kind: LinkedSliderEntityKind;
  placementType: SliderPlacementType;
  sectionTitle: string;
  sectionDescription: string;
  emptyMessage: string;
  linkModalDescription: string;
  unlinkConfirm: string;
  relinkHint: string;
  placementLockedHint: string;
  loadError: string;
};

export const LINKED_SLIDER_ENTITY_CONFIG: Record<LinkedSliderEntityKind, LinkedSliderEntityConfig> = {
  CAMPAIGN: {
    kind: 'CAMPAIGN',
    placementType: 'CAMPAIGN',
    sectionTitle: 'Kampanya Sliderları',
    sectionDescription: 'Bu kampanyaya bağlı slider grupları.',
    emptyMessage: 'Henüz bu kampanyaya bağlı slider grubu yok.',
    linkModalDescription:
      'Bu kampanyaya bağlamak için mevcut slider gruplarından bir veya daha fazlasını seçin.',
    unlinkConfirm:
      'Bu slider grubunun kampanya bağlantısı kaldırılacak. Grup silinmez; yerleşim “Özel” olur.',
    relinkHint: 'başka kampanyadan taşınacak',
    placementLockedHint: 'Yerleşim: Kampanya (bu kampanyaya bağlanacak)',
    loadError: 'Kampanya sliderları yüklenemedi',
  },
  EVENT: {
    kind: 'EVENT',
    placementType: 'EVENT',
    sectionTitle: 'Etkinlik Sliderları',
    sectionDescription: 'Bu etkinliğe bağlı slider grupları.',
    emptyMessage: 'Henüz bu etkinliğe bağlı slider grubu yok.',
    linkModalDescription:
      'Bu etkinliğe bağlamak için mevcut slider gruplarından bir veya daha fazlasını seçin.',
    unlinkConfirm:
      'Bu slider grubunun etkinlik bağlantısı kaldırılacak. Grup silinmez; yerleşim “Özel” olur.',
    relinkHint: 'başka etkinlikten taşınacak',
    placementLockedHint: 'Yerleşim: Etkinlik (bu etkinliğe bağlanacak)',
    loadError: 'Etkinlik sliderları yüklenemedi',
  },
  STORE: {
    kind: 'STORE',
    placementType: 'STORE',
    sectionTitle: 'Mağaza Sliderları',
    sectionDescription: 'Bu AVM mağazasına bağlı slider grupları.',
    emptyMessage: 'Henüz bu mağazaya bağlı slider grubu yok.',
    linkModalDescription:
      'Bu mağazaya bağlamak için mevcut slider gruplarından bir veya daha fazlasını seçin.',
    unlinkConfirm:
      'Bu slider grubunun mağaza bağlantısı kaldırılacak. Grup silinmez; yerleşim “Özel” olur.',
    relinkHint: 'başka mağazadan taşınacak',
    placementLockedHint: 'Yerleşim: Mağaza (bu mağazaya bağlanacak)',
    loadError: 'Mağaza sliderları yüklenemedi',
  },
  LOCATION: {
    kind: 'LOCATION',
    placementType: 'LOCATION',
    sectionTitle: 'Lokasyon Sliderları',
    sectionDescription: 'Bu lokasyona bağlı slider grupları.',
    emptyMessage: 'Henüz bu lokasyona bağlı slider grubu yok.',
    linkModalDescription:
      'Bu lokasyona bağlamak için mevcut slider gruplarından bir veya daha fazlasını seçin.',
    unlinkConfirm:
      'Bu slider grubunun lokasyon bağlantısı kaldırılacak. Grup silinmez; yerleşim “Özel” olur.',
    relinkHint: 'başka lokasyondan taşınacak',
    placementLockedHint: 'Yerleşim: Lokasyon (bu lokasyona bağlanacak)',
    loadError: 'Lokasyon sliderları yüklenemedi',
  },
};

export function getLinkedSliderEntityConfig(
  entityType: LinkedSliderEntityKind,
): LinkedSliderEntityConfig {
  return LINKED_SLIDER_ENTITY_CONFIG[entityType];
}
