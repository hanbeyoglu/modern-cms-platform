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
  apiCampaignsList,
  apiLocalesList,
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
  type CmsCampaign,
  type CmsLocale,
  type ContentChannel,
  type CreateSliderItemPayload,
  type CreateSliderPayload,
  type Slider,
  type SliderItem,
  type SliderLinkedEntityType,
  type SliderPlacementType,
  type SliderStatus,
  API_MAX_PAGE_SIZE,
} from '../lib/api';
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
  desktopMediaId: string;
  mobileMediaId: string;
  sortOrder: string;
  status: SliderStatus;
};

const EMPTY_ITEM: ItemForm = {
  title: '',
  description: '',
  buttonText: '',
  linkUrl: '',
  desktopMediaId: '',
  mobileMediaId: '',
  sortOrder: '0',
  status: 'DRAFT',
};

function itemToForm(item: SliderItem): ItemForm {
  return {
    title: item.title ?? '',
    description: item.description ?? '',
    buttonText: item.buttonText ?? '',
    linkUrl: item.linkUrl ?? '',
    desktopMediaId: item.desktopMediaId ?? '',
    mobileMediaId: item.mobileMediaId ?? '',
    sortOrder: String(item.sortOrder),
    status: item.status,
  };
}

function itemFormToPayload(f: ItemForm): CreateSliderItemPayload {
  return {
    title: f.title || undefined,
    description: f.description || undefined,
    buttonText: f.buttonText || undefined,
    linkUrl: f.linkUrl || undefined,
    desktopMediaId: f.desktopMediaId || undefined,
    mobileMediaId: f.mobileMediaId || undefined,
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
  const [campaigns, setCampaigns] = useState<CmsCampaign[]>([]);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);

  const [editingItemId, setEditingItemId] = useState<string | 'new' | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(EMPTY_ITEM);
  const [itemLocaleDrafts, setItemLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [itemContentLocaleTab, setItemContentLocaleTab] = useState<string | null>(null);
  const [itemI18nDirty, setItemI18nDirty] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [s, locales, campaignRes] = await Promise.all([
        apiSliderGet(accessToken, activeTenantId, id),
        apiLocalesList(accessToken, activeTenantId),
        apiCampaignsList(accessToken, activeTenantId, {
          mallId: activeMallId ?? undefined,
          limit: API_MAX_PAGE_SIZE,
          status: 'PUBLISHED',
        }),
      ]);
      setSlider(s);
      setCampaigns(campaignRes.campaigns);
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

  const itemSaveBlocker = getSliderItemSaveBlocker({
    tenantId: activeTenantId,
    canUpdate,
    desktopMediaId: itemForm.desktopMediaId,
    mobileMediaId: itemForm.mobileMediaId,
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
    setItemI18nDirty(false);
    const defaultLocale = tenantLocales.find((l) => l.isDefault);
    setItemContentLocaleTab(defaultLocale?.id ?? tenantLocales[0]?.id ?? null);
    setEditingItemId('new');
  };

  const openEditItem = (item: SliderItem) => {
    setItemForm(itemToForm(item));
    setItemLocaleDrafts({});
    setItemI18nDirty(false);
    const defaultLocale = tenantLocales.find((l) => l.isDefault);
    setItemContentLocaleTab(defaultLocale?.id ?? tenantLocales[0]?.id ?? null);
    setEditingItemId(item.id);
  };

  const saveItem = async () => {
    if (itemSaveBlocker || !accessToken || !activeTenantId || !id) return;
    setItemSaving(true);
    try {
      let itemId = editingItemId;
      if (editingItemId === 'new') {
        const created = await apiSliderItemCreate(
          accessToken,
          activeTenantId,
          id,
          itemFormToPayload(itemForm),
        );
        itemId = created.id;
      } else if (editingItemId) {
        await apiSliderItemUpdate(
          accessToken,
          activeTenantId,
          id,
          editingItemId,
          itemFormToPayload(itemForm),
        );
      }
      if (itemId && itemId !== 'new' && itemI18nDirty) {
        const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
        await flushSliderTranslations(
          accessToken,
          activeTenantId,
          itemId,
          'SLIDER_ITEM',
          SLIDER_ITEM_I18N_FIELDS,
          itemLocaleDrafts,
          defaultLocaleId,
        );
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

          {groupForm.placementType === 'CAMPAIGN' && (
            <div>
              <label style={labelStyle}>Kampanya</label>
              <select
                style={inputStyle}
                value={groupForm.linkedEntityId}
                onChange={(e) =>
                  setGroupForm({
                    ...groupForm,
                    linkedEntityId: e.target.value,
                    linkedEntityType: 'CAMPAIGN',
                  })
                }
              >
                <option value="">Kampanya seçin</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {groupForm.placementType !== 'CAMPAIGN' && ENTITY_PLACEMENTS.includes(groupForm.placementType) && (
            <div>
              <label style={labelStyle}>Bağlı kayıt ID</label>
              <input
                style={inputStyle}
                value={groupForm.linkedEntityId}
                onChange={(e) => setGroupForm({ ...groupForm, linkedEntityId: e.target.value })}
                placeholder="Entity ID"
              />
            </div>
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
                {item.desktopMedia?.publicUrl && (
                  <img
                    src={item.desktopMedia.publicUrl}
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
                  setItemI18nDirty(true);
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
                  setItemI18nDirty(true);
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              <ContextualMediaPicker
                context="SLIDER_DESKTOP"
                value={itemForm.desktopMediaId}
                mallId={activeMallId ?? undefined}
                onChange={(mediaId) => setItemForm({ ...itemForm, desktopMediaId: mediaId })}
              />
              <ContextualMediaPicker
                context="SLIDER_MOBILE"
                value={itemForm.mobileMediaId}
                mallId={activeMallId ?? undefined}
                onChange={(mediaId) => setItemForm({ ...itemForm, mobileMediaId: mediaId })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Buton metni</label>
                <input
                  style={inputStyle}
                  value={itemForm.buttonText}
                  onChange={(e) => setItemForm({ ...itemForm, buttonText: e.target.value })}
                />
              </div>
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
