import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { Button } from './ui/Button';
import { FormActionHint } from './ui/FormActionHint';
import { ContentChannelFields } from './ContentChannelFields';
import { SliderEntitySelector } from './SliderEntitySelector';
import {
  apiSliderCreate,
  type CreateSliderPayload,
  type Slider,
  type SliderPlacementType,
  type SliderLinkedEntityType,
} from '../lib/api';
import { DEFAULT_CONTENT_CHANNELS, type ContentChannel } from '../lib/content-channels';
import { ENTITY_SLIDER_PLACEMENTS, getSliderCreateBlocker } from '../lib/slider-form-validation';
import {
  LINKED_SLIDER_ENTITY_CONFIG,
  type LinkedSliderEntityKind,
} from '../lib/linked-slider-entities';
import { useSliderEntityOptions } from '../hooks/useSliderEntityOptions';

const PLACEMENT_OPTIONS: { value: SliderPlacementType; label: string }[] = [
  { value: 'HOME', label: 'Ana Sayfa' },
  { value: 'CAMPAIGN', label: 'Kampanya' },
  { value: 'EVENT', label: 'Etkinlik' },
  { value: 'STORE', label: 'Mağaza' },
  { value: 'LOCATION', label: 'Lokasyon' },
  { value: 'CUSTOM', label: 'Özel' },
];

const EMPTY_FORM = {
  title: '',
  placementType: 'HOME' as SliderPlacementType,
  linkedEntityId: '',
  channels: [...DEFAULT_CONTENT_CHANNELS] as ContentChannel[],
};

export type CreateSliderGroupPreset = {
  placementType: SliderPlacementType;
  linkedEntityId: string;
  lockPlacement?: boolean;
};

type Props = {
  open: boolean;
  canCreate: boolean;
  onClose: () => void;
  onCreated: (slider: Slider) => void;
  preset?: CreateSliderGroupPreset;
};

export function CreateSliderGroupModal({ open, canCreate, onClose, onCreated, preset }: Props) {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const entityPlacementType = ENTITY_SLIDER_PLACEMENTS.includes(form.placementType)
    ? form.placementType
    : null;
  const {
    optionsLoading,
    campaigns,
    events,
    stores,
    locations,
  } = useSliderEntityOptions(entityPlacementType, open);

  const resetForm = useCallback(() => {
    setForm({
      title: '',
      placementType: preset?.placementType ?? 'HOME',
      linkedEntityId: preset?.linkedEntityId ?? '',
      channels: [...DEFAULT_CONTENT_CHANNELS],
    });
  }, [preset?.placementType, preset?.linkedEntityId]);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

  const createBlocker = getSliderCreateBlocker({
    tenantId: activeTenantId,
    canCreate,
    title: form.title,
    placementType: form.placementType,
    linkedEntityId: form.linkedEntityId,
    channels: form.channels,
    mallId: activeMallId,
  });

  const handleSubmit = async () => {
    if (createBlocker || !accessToken || !activeTenantId) return;
    setCreating(true);
    try {
      const payload: CreateSliderPayload = {
        title: form.title.trim(),
        placementType: form.placementType,
        channels: form.channels,
        linkedEntityId: form.linkedEntityId.trim() || undefined,
        linkedEntityType: ENTITY_SLIDER_PLACEMENTS.includes(form.placementType)
          ? (form.placementType as SliderLinkedEntityType)
          : undefined,
      };
      const slider = await apiSliderCreate(
        accessToken,
        activeTenantId,
        payload,
        activeMallId ?? undefined,
      );
      onCreated(slider);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxSizing: 'border-box',
  };

  return createPortal(
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-slider-group-title"
        style={{
          background: '#fff',
          borderRadius: 10,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 id="create-slider-group-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Yeni Slider Grubu
          </h2>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Grup başlığı *</label>
            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Örn. Ana sayfa hero"
              autoFocus
            />
          </div>
          {!preset?.lockPlacement && (
            <div>
              <label style={labelStyle}>Yerleşim tipi *</label>
              <select
                style={inputStyle}
                value={form.placementType}
                onChange={(e) => {
                  const placementType = e.target.value as SliderPlacementType;
                  setForm({ ...form, placementType, linkedEntityId: '' });
                }}
              >
                {PLACEMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {preset?.lockPlacement &&
            LINKED_SLIDER_ENTITY_CONFIG[preset.placementType as LinkedSliderEntityKind] && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              {LINKED_SLIDER_ENTITY_CONFIG[preset.placementType as LinkedSliderEntityKind].placementLockedHint}
            </p>
          )}
          {ENTITY_SLIDER_PLACEMENTS.includes(form.placementType) && !preset?.lockPlacement && (
            <SliderEntitySelector
              placementType={form.placementType}
              linkedEntityId={form.linkedEntityId}
              onLinkedEntityIdChange={(linkedEntityId) => setForm({ ...form, linkedEntityId })}
              optionsLoading={optionsLoading}
              campaigns={campaigns}
              events={events}
              stores={stores}
              locations={locations}
              activeMallId={activeMallId}
              labelStyle={labelStyle}
              inputStyle={inputStyle}
              required
            />
          )}
          <ContentChannelFields
            channels={form.channels}
            onChange={(channels) => setForm({ ...form, channels })}
            disabled={creating}
          />
        </div>
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose} disabled={creating}>
              Vazgeç
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={creating || !!createBlocker}
            >
              {creating ? 'Oluşturuluyor…' : 'Slider Grubu Oluştur'}
            </Button>
          </div>
          <FormActionHint message={createBlocker} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
