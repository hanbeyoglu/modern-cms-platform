import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import {
  MultilingualContentFields,
  SLIDER_I18N_FIELDS,
  SLIDER_ITEM_I18N_FIELDS,
} from '../components/MultilingualContentFields';
import { PublishingWorkflowFields } from '../components/PublishingWorkflowFields';
import { ContentChannelFields } from '../components/ContentChannelFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import { validateRangeSchedule } from '../lib/publishing-workflow';
import { DEFAULT_CONTENT_CHANNELS } from '../lib/content-channels';
import {
  apiContentLocales,
  apiSliderArchive,
  apiSliderGet,
  apiSliderItemCreate,
  apiSliderItemDelete,
  apiSliderItemsReorder,
  apiSliderItemUpdate,
  apiSliderPublish,
  apiSliderUpdate,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  type CmsLocale,
  type ContentChannel,
  type CreateSliderItemPayload,
  type CreateSliderPayload,
  type Slider,
  type SliderItem,
  type SliderItemTranslationPayload,
  type SliderLinkedEntityType,
  type SliderPlacementType,
  type SliderStatus,
} from '../lib/api';
import { SliderEntitySelector } from '../components/SliderEntitySelector';
import { useSliderEntityOptions } from '../hooks/useSliderEntityOptions';
import { usePermission } from '../hooks/usePermission';
import { FormActionHint } from '../components/ui/FormActionHint';
import { getSliderGroupSaveBlocker, getSliderItemSaveBlocker } from '../lib/slider-form-validation';

const PLACEMENT_OPTIONS: { value: SliderPlacementType; label: string }[] = [
  { value: 'HOME', label: 'Ana Sayfa' },
  { value: 'CAMPAIGN', label: 'Kampanya' },
  { value: 'EVENT', label: 'Etkinlik' },
  { value: 'STORE', label: 'Mağaza' },
  { value: 'LOCATION', label: 'Konum' },
  { value: 'CUSTOM', label: 'Özel' },
];

const ENTITY_PLACEMENTS: SliderPlacementType[] = ['CAMPAIGN', 'EVENT', 'STORE', 'LOCATION'];

type GroupForm = {
  title: string;
  placementType: SliderPlacementType;
  linkedEntityType: SliderLinkedEntityType | '';
  linkedEntityId: string;
  startAt: string;
  endAt: string;
  sortOrder: string;
  status: SliderStatus;
  channels: ContentChannel[];
};

type ItemForm = {
  title: string;
  description: string;
  buttonText: string;
  linkUrl: string;
  sameImageForAllLocales: boolean;
  sharedImageId: string;
  sharedMobileImageId: string;
  desktopMediaWidthOverride: string;
  desktopMediaHeightOverride: string;
  mobileMediaWidthOverride: string;
  mobileMediaHeightOverride: string;
  sortOrder: string;
  status: SliderStatus;
};

const EMPTY_ITEM: ItemForm = {
  title: '',
  description: '',
  buttonText: '',
  linkUrl: '',
  sameImageForAllLocales: true,
  sharedImageId: '',
  sharedMobileImageId: '',
  desktopMediaWidthOverride: '',
  desktopMediaHeightOverride: '',
  mobileMediaWidthOverride: '',
  mobileMediaHeightOverride: '',
  sortOrder: '0',
  status: 'DRAFT',
};

function itemToForm(item: SliderItem): ItemForm {
  return {
    title: item.title ?? '',
    description: item.description ?? '',
    buttonText: item.buttonText ?? '',
    linkUrl: item.linkUrl ?? '',
    sameImageForAllLocales: item.sameImageForAllLocales ?? true,
    sharedImageId: item.sharedImageId ?? '',
    sharedMobileImageId: item.sharedMobileImageId ?? '',
    desktopMediaWidthOverride: item.desktopMediaWidthOverride ? String(item.desktopMediaWidthOverride) : '',
    desktopMediaHeightOverride: item.desktopMediaHeightOverride ? String(item.desktopMediaHeightOverride) : '',
    mobileMediaWidthOverride: item.mobileMediaWidthOverride ? String(item.mobileMediaWidthOverride) : '',
    mobileMediaHeightOverride: item.mobileMediaHeightOverride ? String(item.mobileMediaHeightOverride) : '',
    sortOrder: String(item.sortOrder),
    status: item.status,
  };
}

function parseOptionalDimension(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildItemTranslationsPayload(
  form: ItemForm,
  localeDrafts: Record<string, Record<string, string>>,
  locales: CmsLocale[],
): SliderItemTranslationPayload[] {
  const defaultLocaleId = locales.find((l) => l.isDefault)?.id;
  return locales
    .filter((l) => l.isActive)
    .map((locale) => {
      const isDefault = locale.id === defaultLocaleId;
      const draft = localeDrafts[locale.id] ?? {};
      const localeImageId = isDefault
        ? form.sameImageForAllLocales
          ? null
          : form.sharedImageId || null
        : draft.imageId?.trim() || null;
      const localeMobileImageId = isDefault
        ? form.sameImageForAllLocales
          ? null
          : form.sharedMobileImageId || null
        : draft.mobileImageId?.trim() || null;

      return {
        localeId: locale.id,
        title: isDefault ? form.title || null : draft.title?.trim() || null,
        description: isDefault ? form.description || null : draft.description?.trim() || null,
        buttonText: isDefault ? form.buttonText || null : draft.buttonText?.trim() || null,
        imageId: localeImageId,
        mobileImageId: localeMobileImageId,
      };
    });
}

function itemFormToPayload(
  f: ItemForm,
  localeDrafts: Record<string, Record<string, string>>,
  locales: CmsLocale[],
): CreateSliderItemPayload {
  return {
    title: f.title || undefined,
    description: f.description || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    sameImageForAllLocales: f.sameImageForAllLocales,
    sharedImageId: f.sharedImageId || undefined,
    sharedMobileImageId: f.sharedMobileImageId || undefined,
    translations: buildItemTranslationsPayload(f, localeDrafts, locales),
    desktopMediaWidthOverride: parseOptionalDimension(f.desktopMediaWidthOverride),
    desktopMediaHeightOverride: parseOptionalDimension(f.desktopMediaHeightOverride),
    mobileMediaWidthOverride: parseOptionalDimension(f.mobileMediaWidthOverride),
    mobileMediaHeightOverride: parseOptionalDimension(f.mobileMediaHeightOverride),
    sortOrder: parseInt(f.sortOrder, 10) || 0,
    status: f.status,
  };
}

async function flushSliderTranslations(
  token: string,
  tenantId: string,
  entityId: string,
  entityType: 'SLIDER' | 'SLIDER_ITEM',
  fields: readonly string[],
  localeDrafts: Record<string, Record<string, string>>,
  defaultLocaleId: string | undefined,
) {
  const existing = await apiTranslationsList(token, tenantId, { entityType, entityId });
  for (const [localeId, draft] of Object.entries(localeDrafts)) {
    if (localeId === defaultLocaleId) continue;
    for (const field of fields) {
      const value = draft[field]?.trim();
      const prev = existing.find((t) => t.localeId === localeId && t.field === field);
      if (value) {
        await apiTranslationUpsert(token, tenantId, {
          localeId,
          entityType,
          entityId,
          field,
          value,
        });
      } else if (prev) {
        await apiTranslationDelete(token, tenantId, prev.id);
      }
    }
  }
}

export function SliderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const canUpdate = can('slider:update');
  const canPublish = can('slider:publish');

  const [slider, setSlider] = useState<Slider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupForm | null>(null);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM);
  const [itemLocaleDrafts, setItemLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [itemContentLocaleTab, setItemContentLocaleTab] = useState<string | null>(null);
  const [itemSaving, setItemSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, locales] = await Promise.all([
        apiSliderGet(accessToken, activeTenantId, id),
        apiContentLocales(accessToken, activeTenantId, activeMallId),
      ]);
      setSlider(s);
      setTenantLocales(locales);
      const defaultLocale = locales.find((l) => l.isDefault);
      setContentLocaleTab(defaultLocale?.id ?? locales[0]?.id ?? null);
      setGroupForm({
        title: s.title,
        placementType: s.placementType,
        linkedEntityType: s.linkedEntityType ?? '',
        linkedEntityId: s.linkedEntityId ?? '',
        startAt: s.startAt ? s.startAt.slice(0, 16) : '',
        endAt: s.endAt ? s.endAt.slice(0, 16) : '',
        sortOrder: String(s.sortOrder),
        status: s.status,
        channels: s.channels?.length ? [...s.channels] : [...DEFAULT_CONTENT_CHANNELS],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Slider yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, activeMallId, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const entityPlacementType =
    groupForm && ENTITY_PLACEMENTS.includes(groupForm.placementType)
      ? groupForm.placementType
      : null;
  const {
    optionsLoading: entityOptionsLoading,
    campaigns,
    events,
    stores,
    locations,
  } = useSliderEntityOptions(entityPlacementType, !!groupForm);

  const groupSaveBlocker = groupForm
    ? getSliderGroupSaveBlocker({
        tenantId: activeTenantId,
        canUpdate,
        title: groupForm.title,
        placementType: groupForm.placementType,
        linkedEntityId: groupForm.linkedEntityId,
        channels: groupForm.channels,
      })
    : null;

  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
  const defaultLocaleDraftImageId = defaultLocaleId
    ? itemLocaleDrafts[defaultLocaleId]?.imageId ?? ''
    : '';
  const itemSaveBlocker = getSliderItemSaveBlocker({
    tenantId: activeTenantId,
    canUpdate,
    sameImageForAllLocales: itemForm.sameImageForAllLocales,
    sharedImageId: itemForm.sharedImageId,
    defaultLocaleImageId: itemForm.sameImageForAllLocales
      ? undefined
      : itemForm.sharedImageId || defaultLocaleDraftImageId,
  });

  const saveGroup = async () => {
    if (groupSaveBlocker || !accessToken || !activeTenantId || !id || !groupForm) return;
    const scheduleErr = validateRangeSchedule(groupForm.status, groupForm.startAt);
    if (scheduleErr) {
      toast.error(scheduleErr);
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<CreateSliderPayload> = {
        title: groupForm.title,
        placementType: groupForm.placementType,
        linkedEntityType: ENTITY_PLACEMENTS.includes(groupForm.placementType)
          ? (groupForm.placementType as SliderLinkedEntityType)
          : undefined,
        linkedEntityId: ENTITY_PLACEMENTS.includes(groupForm.placementType)
          ? groupForm.linkedEntityId || undefined
          : undefined,
        startAt: groupForm.startAt ? new Date(groupForm.startAt).toISOString() : undefined,
        endAt: groupForm.endAt ? new Date(groupForm.endAt).toISOString() : undefined,
        sortOrder: parseInt(groupForm.sortOrder, 10) || 0,
        status: groupForm.status,
        channels: groupForm.channels.length ? groupForm.channels : undefined,
      };
      await apiSliderUpdate(accessToken, activeTenantId, id, payload);
      const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
      if (i18nDirty) {
        await flushSliderTranslations(
          accessToken,
          activeTenantId,
          id,
          'SLIDER',
          SLIDER_I18N_FIELDS,
          localeDrafts,
          defaultLocaleId,
        );
      }
      toast.success('Grup kaydedildi');
      setI18nDirty(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const openNewItem = () => {
    const nextOrder = slider?.items?.length ?? 0;
    setItemForm({ ...EMPTY_ITEM, sortOrder: String(nextOrder) });
    setItemLocaleDrafts({});
    setItemContentLocaleTab(defaultLocaleId ?? tenantLocales[0]?.id ?? null);
    setEditingItemId('new');
  };

  const openEditItem = (item: SliderItem) => {
    const defaultLocale = tenantLocales.find((l) => l.isDefault);
    const form = itemToForm(item);
    if (!item.sameImageForAllLocales && defaultLocale) {
      const defaultTr = item.translations?.find((t) => t.localeId === defaultLocale.id);
      if (defaultTr) {
        form.sharedImageId = defaultTr.imageId ?? form.sharedImageId;
        form.sharedMobileImageId = defaultTr.mobileImageId ?? form.sharedMobileImageId;
      }
    }
    setItemForm(form);
    const drafts: Record<string, Record<string, string>> = {};
    for (const tr of item.translations ?? []) {
      if (tr.localeId === defaultLocale?.id) continue;
      drafts[tr.localeId] = {
        title: tr.title ?? '',
        description: tr.description ?? '',
        buttonText: tr.buttonText ?? '',
        imageId: tr.imageId ?? '',
        mobileImageId: tr.mobileImageId ?? '',
      };
    }
    setItemLocaleDrafts(drafts);
    setItemContentLocaleTab(defaultLocale?.id ?? tenantLocales[0]?.id ?? null);
    setEditingItemId(item.id);
  };

  const saveItem = async () => {
    if (itemSaveBlocker || !accessToken || !activeTenantId || !id) return;
    setItemSaving(true);
    try {
      const payload = itemFormToPayload(itemForm, itemLocaleDrafts, tenantLocales);
      if (editingItemId === 'new') {
        await apiSliderItemCreate(accessToken, activeTenantId, id, payload);
      } else if (editingItemId) {
        await apiSliderItemUpdate(accessToken, activeTenantId, id, editingItemId, payload);
      }
      toast.success('Slayt kaydedildi');
      setEditingItemId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Slayt kaydedilemedi');
    } finally {
      setItemSaving(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!accessToken || !activeTenantId || !id) return;
    if (!window.confirm('Bu slaytı silmek istediğinize emin misiniz?')) return;
    try {
      await apiSliderItemDelete(accessToken, activeTenantId, id, itemId);
      toast.success('Slayt silindi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const moveItem = async (itemId: string, direction: -1 | 1) => {
    if (!accessToken || !activeTenantId || !id || !slider?.items) return;
    const items = [...slider.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = items.findIndex((i) => i.id === itemId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return;
    const reordered = items.map((item, i) => {
      if (i === idx) return { id: item.id, sortOrder: swapIdx };
      if (i === swapIdx) return { id: item.id, sortOrder: idx };
      return { id: item.id, sortOrder: i };
    });
    try {
      await apiSliderItemsReorder(accessToken, activeTenantId, id, reordered);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıralama güncellenemedi');
    }
  };

  if (loading) return <LoadingState label="Slider yükleniyor…" />;
  if (error || !slider || !groupForm) {
    return (
      <PageContainer>
        <ErrorBanner message={error ?? 'Slider bulunamadı'} onDismiss={() => void load()} />
        <Link to="/sliders">← Slider listesine dön</Link>
      </PageContainer>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 3,
  };

  return (
    <PageContainer>
      <div style={{ marginBottom: 16 }}>
        <Link to="/sliders" style={{ fontSize: 13, color: '#6b7280' }}>
          ← Slider grupları
        </Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 22, fontWeight: 700 }}>{slider.title}</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          Grup ayarları ve slayt öğeleri
        </p>
        {!activeTenantId && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#b45309' }}>Önce tenant seçmelisiniz</p>
        )}
      </div>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 20,
          background: '#fafafa',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Grup Ayarları</h2>

        {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
          <MultilingualContentFields
            locales={tenantLocales}
            fields={SLIDER_I18N_FIELDS}
            activeLocaleId={contentLocaleTab}
            onTabChange={setContentLocaleTab}
            defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
            getValue={(localeId, field) => {
              const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
              if (defaultLocaleId && localeId === defaultLocaleId) {
                return groupForm.title;
              }
              return localeDrafts[localeId]?.[field] ?? '';
            }}
            setValue={(localeId, field, value) => {
              const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
              if (defaultLocaleId && localeId === defaultLocaleId && field === 'title') {
                setGroupForm({ ...groupForm, title: value });
                return;
              }
              setLocaleDrafts((d) => ({ ...d, [localeId]: { ...d[localeId], [field]: value } }));
              setI18nDirty(true);
            }}
            onCopyFromDefault={(targetId) => {
              setLocaleDrafts((d) => ({
                ...d,
                [targetId]: { title: groupForm.title },
              }));
              setI18nDirty(true);
            }}
            disabled={saving}
          />
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Grup başlığı *</label>
            <input
              style={inputStyle}
              value={groupForm.title}
              onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
            />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div>
            <label style={labelStyle}>Yerleşim</label>
            <select
              style={inputStyle}
              value={groupForm.placementType}
              onChange={(e) => {
                const placementType = e.target.value as SliderPlacementType;
                setGroupForm({
                  ...groupForm,
                  placementType,
                  linkedEntityType: ENTITY_PLACEMENTS.includes(placementType)
                    ? (placementType as SliderLinkedEntityType)
                    : '',
                  linkedEntityId: '',
                });
              }}
            >
              {PLACEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {ENTITY_PLACEMENTS.includes(groupForm.placementType) && (
            <SliderEntitySelector
              placementType={groupForm.placementType}
              linkedEntityId={groupForm.linkedEntityId}
              onLinkedEntityIdChange={(linkedEntityId) =>
                setGroupForm({
                  ...groupForm,
                  linkedEntityId,
                  linkedEntityType: groupForm.placementType as SliderLinkedEntityType,
                })
              }
              optionsLoading={entityOptionsLoading}
              campaigns={campaigns}
              events={events}
              stores={stores}
              locations={locations}
              activeMallId={activeMallId}
              labelStyle={labelStyle}
              inputStyle={inputStyle}
            />
          )}

          <div>
            <label style={labelStyle}>Sıra</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={groupForm.sortOrder}
              onChange={(e) => setGroupForm({ ...groupForm, sortOrder: e.target.value })}
            />
          </div>
        </div>

        <PublishingWorkflowFields
          mode="range"
          status={groupForm.status}
          startAt={groupForm.startAt}
          endAt={groupForm.endAt}
          onStatusChange={(status) => setGroupForm({ ...groupForm, status })}
          onStartAtChange={(startAt) => setGroupForm({ ...groupForm, startAt })}
          onEndAtChange={(endAt) => setGroupForm({ ...groupForm, endAt })}
        />

        <ContentChannelFields
          channels={groupForm.channels}
          onChange={(channels) => setGroupForm({ ...groupForm, channels })}
        />

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={() => void saveGroup()} disabled={saving || !!groupSaveBlocker}>
              {saving ? 'Kaydediliyor…' : 'Grubu Kaydet'}
            </Button>
            {canPublish && slider.status !== 'PUBLISHED' && (
              <Button
                variant="secondary"
                disabled={!activeTenantId}
                onClick={async () => {
                  await apiSliderPublish(accessToken!, activeTenantId!, id!);
                  toast.success('Yayınlandı');
                  void load();
                }}
              >
                Yayınla
              </Button>
            )}
            {canUpdate && slider.status === 'PUBLISHED' && (
              <Button
                variant="secondary"
                disabled={!activeTenantId}
                onClick={async () => {
                  await apiSliderArchive(accessToken!, activeTenantId!, id!);
                  toast.success('Arşivlendi');
                  void load();
                }}
              >
                Arşivle
              </Button>
            )}
          </div>
          <FormActionHint message={groupSaveBlocker} />
        </div>
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
            Slaytlar ({slider.items?.length ?? 0})
          </h2>
          <Button size="sm" onClick={openNewItem} disabled={!canUpdate || !activeTenantId}>
            + Slayt Ekle
          </Button>
        </div>
        {!canUpdate && (
          <FormActionHint message="Slider düzenleme yetkiniz yok" />
        )}
        {canUpdate && !activeTenantId && (
          <FormActionHint message="Önce tenant seçmelisiniz" />
        )}

        {(slider.items?.length ?? 0) === 0 && !editingItemId && (
          <p style={{ fontSize: 13, color: '#6b7280' }}>Henüz slayt yok. İlk slaytı ekleyin.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...(slider.items ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item, index, arr) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  background: '#fff',
                }}
              >
                {item.sharedImage?.publicUrl && (
                  <img
                    src={item.sharedImage.publicUrl}
                    alt=""
                    style={{
                      width: 120,
                      height: 68,
                      objectFit: 'cover',
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {item.title || '(Başlıksız slayt)'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Sıra: {item.sortOrder} · {item.status}
                  </div>
                </div>
                {canUpdate && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => void moveItem(item.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === arr.length - 1}
                      onClick={() => void moveItem(item.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>
                      Düzenle
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void deleteItem(item.id)}>
                      Sil
                    </Button>
                  </div>
                )}
              </div>
            ))}
        </div>

        {editingItemId && (
          <div
            style={{
              marginTop: 16,
              border: '2px solid #2563eb',
              borderRadius: 8,
              padding: 20,
              background: '#f8fafc',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
              {editingItemId === 'new' ? 'Yeni Slayt' : 'Slayt Düzenle'}
            </h3>

            {tenantLocales.filter((l) => l.isActive).length > 0 && itemContentLocaleTab ? (
              <MultilingualContentFields
                locales={tenantLocales}
                fields={SLIDER_ITEM_I18N_FIELDS}
                activeLocaleId={itemContentLocaleTab}
                onTabChange={setItemContentLocaleTab}
                defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                getValue={(localeId, field) => {
                  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defaultLocaleId && localeId === defaultLocaleId) {
                    return String(itemForm[field as keyof ItemForm] ?? '');
                  }
                  return itemLocaleDrafts[localeId]?.[field] ?? '';
                }}
                setValue={(localeId, field, value) => {
                  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defaultLocaleId && localeId === defaultLocaleId) {
                    setItemForm({ ...itemForm, [field]: value });
                    return;
                  }
                  setItemLocaleDrafts((d) => ({
                    ...d,
                    [localeId]: { ...d[localeId], [field]: value },
                  }));
                }}
                onCopyFromDefault={(targetId) => {
                  setItemLocaleDrafts((d) => ({
                    ...d,
                    [targetId]: {
                      title: itemForm.title,
                      description: itemForm.description,
                      buttonText: itemForm.buttonText,
                    },
                  }));
                }}
                disabled={itemSaving}
              />
            ) : (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Başlık</label>
                  <input
                    style={inputStyle}
                    value={itemForm.title}
                    onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Açıklama</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 60 }}
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  />
                </div>
              </>
            )}

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                fontSize: 13,
                cursor: itemSaving ? 'not-allowed' : 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={itemForm.sameImageForAllLocales}
                disabled={itemSaving}
                onChange={(e) =>
                  setItemForm({ ...itemForm, sameImageForAllLocales: e.target.checked })
                }
              />
              Tüm diller için aynı görselleri kullan
            </label>

            {itemForm.sameImageForAllLocales ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                <ContextualMediaPicker
                  context="SLIDER_DESKTOP"
                  value={itemForm.sharedImageId}
                  mallId={activeMallId ?? undefined}
                  onChange={(mediaId) => setItemForm({ ...itemForm, sharedImageId: mediaId })}
                  dimensionOverride={{
                    width: parseOptionalDimension(itemForm.desktopMediaWidthOverride),
                    height: parseOptionalDimension(itemForm.desktopMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) =>
                    setItemForm({
                      ...itemForm,
                      desktopMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                      desktopMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                    })
                  }
                />
                <ContextualMediaPicker
                  context="SLIDER_MOBILE"
                  value={itemForm.sharedMobileImageId}
                  mallId={activeMallId ?? undefined}
                  onChange={(mediaId) => setItemForm({ ...itemForm, sharedMobileImageId: mediaId })}
                  dimensionOverride={{
                    width: parseOptionalDimension(itemForm.mobileMediaWidthOverride),
                    height: parseOptionalDimension(itemForm.mobileMediaHeightOverride),
                  }}
                  onDimensionOverrideChange={(dimensions) =>
                    setItemForm({
                      ...itemForm,
                      mobileMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                      mobileMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                    })
                  }
                />
              </div>
            ) : (
              tenantLocales.filter((l) => l.isActive).length > 0 &&
              itemContentLocaleTab && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                  <ContextualMediaPicker
                    context="SLIDER_DESKTOP"
                    value={
                      itemContentLocaleTab === defaultLocaleId
                        ? itemForm.sharedImageId
                        : itemLocaleDrafts[itemContentLocaleTab]?.imageId ?? ''
                    }
                    mallId={activeMallId ?? undefined}
                    onChange={(mediaId) => {
                      if (itemContentLocaleTab === defaultLocaleId) {
                        setItemForm({ ...itemForm, sharedImageId: mediaId });
                        return;
                      }
                      setItemLocaleDrafts((d) => ({
                        ...d,
                        [itemContentLocaleTab]: { ...d[itemContentLocaleTab], imageId: mediaId },
                      }));
                    }}
                    dimensionOverride={{
                      width: parseOptionalDimension(itemForm.desktopMediaWidthOverride),
                      height: parseOptionalDimension(itemForm.desktopMediaHeightOverride),
                    }}
                    onDimensionOverrideChange={(dimensions) =>
                      setItemForm({
                        ...itemForm,
                        desktopMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                        desktopMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                      })
                    }
                  />
                  <ContextualMediaPicker
                    context="SLIDER_MOBILE"
                    value={
                      itemContentLocaleTab === defaultLocaleId
                        ? itemForm.sharedMobileImageId
                        : itemLocaleDrafts[itemContentLocaleTab]?.mobileImageId ?? ''
                    }
                    mallId={activeMallId ?? undefined}
                    onChange={(mediaId) => {
                      if (itemContentLocaleTab === defaultLocaleId) {
                        setItemForm({ ...itemForm, sharedMobileImageId: mediaId });
                        return;
                      }
                      setItemLocaleDrafts((d) => ({
                        ...d,
                        [itemContentLocaleTab]: { ...d[itemContentLocaleTab], mobileImageId: mediaId },
                      }));
                    }}
                    dimensionOverride={{
                      width: parseOptionalDimension(itemForm.mobileMediaWidthOverride),
                      height: parseOptionalDimension(itemForm.mobileMediaHeightOverride),
                    }}
                    onDimensionOverrideChange={(dimensions) =>
                      setItemForm({
                        ...itemForm,
                        mobileMediaWidthOverride: dimensions.width ? String(dimensions.width) : '',
                        mobileMediaHeightOverride: dimensions.height ? String(dimensions.height) : '',
                      })
                    }
                  />
                </div>
              )
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Bağlantı URL</label>
                <input
                  style={inputStyle}
                  value={itemForm.linkUrl}
                  onChange={(e) => setItemForm({ ...itemForm, linkUrl: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <Button onClick={() => void saveItem()} disabled={itemSaving || !!itemSaveBlocker}>
                {itemSaving ? 'Kaydediliyor…' : 'Slaytı Kaydet'}
              </Button>
              <Button variant="ghost" onClick={() => setEditingItemId(null)}>
                İptal
              </Button>
            </div>
            <FormActionHint message={itemSaveBlocker} />
          </div>
        )}
      </section>
    </PageContainer>
  );
}
