import type { CSSProperties } from 'react';
import {
  type CmsCampaign,
  type CmsEvent,
  type CmsLocation,
  type MallStore,
  type SliderPlacementType,
} from '../lib/api';
import { FormActionHint } from './ui/FormActionHint';
import { locationLabel, mallStoreLabel } from '../hooks/useSliderEntityOptions';

type Props = {
  placementType: SliderPlacementType;
  linkedEntityId: string;
  onLinkedEntityIdChange: (id: string) => void;
  optionsLoading: boolean;
  campaigns: CmsCampaign[];
  events: CmsEvent[];
  stores: MallStore[];
  locations: CmsLocation[];
  activeMallId: string | null;
  labelStyle: CSSProperties;
  inputStyle: CSSProperties;
  required?: boolean;
};

function EmptySelectOption() {
  return (
    <option value="" disabled>
      Kayıt bulunamadı
    </option>
  );
}

export function SliderEntitySelector({
  placementType,
  linkedEntityId,
  onLinkedEntityIdChange,
  optionsLoading,
  campaigns,
  events,
  stores,
  locations,
  activeMallId,
  labelStyle,
  inputStyle,
  required = false,
}: Props) {
  const requiredSuffix = required ? ' *' : '';

  if (placementType === 'STORE' && !activeMallId) {
    return <FormActionHint message="Önce lokasyon seçmelisiniz" />;
  }

  if (optionsLoading) {
    return <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>Seçenekler yükleniyor…</p>;
  }

  if (placementType === 'CAMPAIGN') {
    return (
      <div>
        <label style={labelStyle}>Kampanya{requiredSuffix}</label>
        <select
          style={inputStyle}
          value={linkedEntityId}
          onChange={(e) => onLinkedEntityIdChange(e.target.value)}
        >
          {campaigns.length === 0 ? (
            <EmptySelectOption />
          ) : (
            <>
              <option value="">Kampanya seçin</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    );
  }

  if (placementType === 'EVENT') {
    return (
      <div>
        <label style={labelStyle}>Etkinlik{requiredSuffix}</label>
        <select
          style={inputStyle}
          value={linkedEntityId}
          onChange={(e) => onLinkedEntityIdChange(e.target.value)}
        >
          {events.length === 0 ? (
            <EmptySelectOption />
          ) : (
            <>
              <option value="">Etkinlik seçin</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    );
  }

  if (placementType === 'STORE') {
    return (
      <div>
        <label style={labelStyle}>Mağaza{requiredSuffix}</label>
        <select
          style={inputStyle}
          value={linkedEntityId}
          onChange={(e) => onLinkedEntityIdChange(e.target.value)}
        >
          {stores.length === 0 ? (
            <EmptySelectOption />
          ) : (
            <>
              <option value="">Mağaza seçin</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {mallStoreLabel(s)}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    );
  }

  if (placementType === 'LOCATION') {
    return (
      <div>
        <label style={labelStyle}>Lokasyon{requiredSuffix}</label>
        <select
          style={inputStyle}
          value={linkedEntityId}
          onChange={(e) => onLinkedEntityIdChange(e.target.value)}
        >
          {locations.length === 0 ? (
            <EmptySelectOption />
          ) : (
            <>
              <option value="">Lokasyon seçin</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {locationLabel(loc)}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    );
  }

  return null;
}
