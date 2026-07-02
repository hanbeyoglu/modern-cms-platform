import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from './ui/EmptyState';
import { LoadingState } from './ui/LoadingState';
import { Button } from './ui/Button';
import {
  apiMallFloorCreate,
  apiMallFloorDelete,
  apiMallFloorUpdate,
  apiMallFloorsList,
  apiMallFloorsReorder,
  apiContentLocales,
  apiTranslationsList,
  apiTranslationUpsert,
  apiTranslationDelete,
  type MallFloor,
  type CmsLocale,
} from '../lib/api';
import {
  MultilingualContentFields,
  MALL_FLOOR_I18N_FIELDS,
} from './MultilingualContentFields';
import { usePermission } from '../hooks/usePermission';

type Props = {
  accessToken: string;
  tenantId: string;
  mallId: string;
  canEdit: boolean;
  search?: string;
  showScopeHint?: boolean;
  formOpen?: boolean;
  onFormOpenChange?: (open: boolean) => void;
};

export function MallFloorsSection({
  accessToken,
  tenantId,
  mallId,
  canEdit,
  search,
  showScopeHint = true,
  formOpen,
  onFormOpenChange,
}: Props) {
  const { can } = usePermission();
  const canReadTranslations = can('translation:read');
  const canCreateTranslations = can('translation:create');
  const canDeleteTranslations = can('translation:delete');
  const [floors, setFloors] = useState<MallFloor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [internalFormOpen, setInternalFormOpen] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});

  const showForm = formOpen ?? internalFormOpen;
  const setShowForm = (open: boolean) => {
    onFormOpenChange?.(open);
    if (formOpen === undefined) setInternalFormOpen(open);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiMallFloorsList(accessToken, tenantId, mallId);
      setFloors(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Katlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, mallId]);

  useEffect(() => {
    setName('');
    setLabel('');
    setEditingId(null);
    setLocaleDrafts({});
    setShowForm(false);
  }, [mallId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showForm || !accessToken || !tenantId) return;
    void (async () => {
      try {
        const locs = await apiContentLocales(accessToken, tenantId, mallId);
        setTenantLocales(locs);
        const activeLocales = locs.filter((l) => l.isActive);
        const defaultLocale = locs.find((l) => l.isDefault);
        setContentLocaleTab((prev) => {
          if (prev && activeLocales.some((l) => l.id === prev)) return prev;
          return defaultLocale?.id ?? activeLocales[0]?.id ?? null;
        });
        if (editingId && canReadTranslations) {
          const translations = await apiTranslationsList(accessToken, tenantId, {
            entityType: 'MALL_FLOOR',
            entityId: editingId,
          });
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = { label: '' };
            for (const field of MALL_FLOOR_I18N_FIELDS) {
              drafts[loc.id][field] =
                translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
            }
          }
          setLocaleDrafts(drafts);
        } else if (!editingId) {
          const drafts: Record<string, Record<string, string>> = {};
          for (const loc of activeLocales) {
            if (loc.id === defaultLocale?.id) continue;
            drafts[loc.id] = Object.fromEntries(
              MALL_FLOOR_I18N_FIELDS.map((field) => [field, '']),
            );
          }
          setLocaleDrafts(drafts);
        } else {
          setLocaleDrafts({});
        }
      } catch {
        setTenantLocales([]);
        setLocaleDrafts({});
      }
    })();
  }, [showForm, editingId, accessToken, tenantId, mallId, canReadTranslations]);

  function resetForm() {
    setName('');
    setLabel('');
    setEditingId(null);
    setLocaleDrafts({});
    setShowForm(false);
  }

  function openCreate() {
    setEditingId(null);
    setName('');
    setLabel('');
    setLocaleDrafts({});
    setShowForm(true);
  }

  function openEdit(floor: MallFloor) {
    setEditingId(floor.id);
    setName(floor.name);
    setLabel(floor.label);
    setShowForm(true);
  }

  const visibleFloors = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase();
    if (!q) return floors;
    return floors.filter(
      (f) => f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q),
    );
  }, [floors, search]);

  async function flushTranslations(entityId: string) {
    if (!canCreateTranslations) return;
    const defaultLocale = tenantLocales.find((l) => l.isDefault);
    const translations = await apiTranslationsList(accessToken, tenantId, {
      entityType: 'MALL_FLOOR',
      entityId,
    });
    const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
    for (const loc of tenantLocales.filter((l) => l.isActive)) {
      if (!defaultLocale || loc.id === defaultLocale.id) continue;
      const slice = localeDrafts[loc.id] ?? {};
      for (const field of MALL_FLOOR_I18N_FIELDS) {
        const value = (slice[field] ?? '').trim();
        const prevId = idByKey.get(`${loc.id}:${field}`);
        if (!value) {
          if (prevId && canDeleteTranslations) await apiTranslationDelete(accessToken, tenantId, prevId);
          continue;
        }
        await apiTranslationUpsert(accessToken, tenantId, {
          localeCode: loc.code,
          entityType: 'MALL_FLOOR',
          entityId,
          field,
          value,
        });
      }
    }
  }

  async function saveFloor() {
    const trimmedName = name.trim();
    const trimmedLabel = label.trim();
    if (!trimmedName) {
      toast.error('Kat kodu zorunludur.');
      return;
    }
    if (!trimmedLabel) {
      toast.error('Varsayılan dilde etiket zorunludur.');
      return;
    }
    setSaving(true);
    try {
      let floorId = editingId;
      if (editingId) {
        await apiMallFloorUpdate(accessToken, tenantId, mallId, editingId, {
          name: trimmedName,
          label: trimmedLabel,
        });
        toast.success('Kat güncellendi');
      } else {
        const created = await apiMallFloorCreate(accessToken, tenantId, mallId, {
          name: trimmedName,
          label: trimmedLabel,
          sortOrder: floors.length,
        });
        floorId = created.id;
        toast.success('Kat eklendi');
      }
      if (floorId) await flushTranslations(floorId);
      resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(floor: MallFloor) {
    try {
      await apiMallFloorUpdate(accessToken, tenantId, mallId, floor.id, { active: !floor.active });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncelleme hatası');
    }
  }

  async function removeFloor(id: string) {
    if (!window.confirm('Bu katı silmek istiyor musunuz?')) return;
    try {
      await apiMallFloorDelete(accessToken, tenantId, mallId, id);
      await load();
      toast.success('Kat silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme hatası');
    }
  }

  async function moveFloor(id: string, direction: -1 | 1) {
    const index = floors.findIndex((f) => f.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= floors.length) return;
    const ordered = [...floors];
    const [item] = ordered.splice(index, 1);
    ordered.splice(target, 0, item);
    try {
      await apiMallFloorsReorder(accessToken, tenantId, mallId, ordered.map((f) => f.id));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıralama hatası');
    }
  }

  const activeLocales = tenantLocales.filter((l) => l.isActive);

  return (
    <div>
      {showScopeHint ? (
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
          Mağaza formlarında kullanılacak kat listesini yönetin.
        </p>
      ) : null}
      {canEdit ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <Button variant="secondary" onClick={openCreate}>
            + Kat Ekle
          </Button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Kat eklemek için düzenleme yetkisi gerekir.
        </p>
      )}

      {canEdit && showForm ? (
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            background: '#fafafa',
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 14 }}>{editingId ? 'Kat düzenle' : 'Yeni kat'}</h3>
          <div style={{ display: 'grid', gap: 10, maxWidth: 720 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Kod *</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                Teknik kat kodu; tüm dillerde aynıdır (ör. B1, G, P1).
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ör. B1"
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', maxWidth: 240 }}
              />
            </label>

            {activeLocales.length > 0 && contentLocaleTab ? (
              <MultilingualContentFields
                locales={tenantLocales}
                fields={MALL_FLOOR_I18N_FIELDS}
                requiredField="label"
                activeLocaleId={contentLocaleTab}
                onTabChange={setContentLocaleTab}
                defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                getValue={(localeId, field) => {
                  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defaultLocaleId && localeId === defaultLocaleId) {
                    return label;
                  }
                  return localeDrafts[localeId]?.[field] ?? '';
                }}
                setValue={(localeId, field, value) => {
                  const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                  if (defaultLocaleId && localeId === defaultLocaleId) {
                    if (field === 'label') setLabel(value);
                    return;
                  }
                  setLocaleDrafts((drafts) => ({
                    ...drafts,
                    [localeId]: { ...drafts[localeId], [field]: value },
                  }));
                }}
                disabled={!canEdit}
                onCopyFromDefault={(targetLocaleId) => {
                  setLocaleDrafts((drafts) => ({
                    ...drafts,
                    [targetLocaleId]: {
                      ...(drafts[targetLocaleId] ?? {}),
                      label,
                    },
                  }));
                }}
              />
            ) : (
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Etiket *</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="ör. 1. Kat"
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" disabled={saving} onClick={() => void saveFloor()}>
                {saving ? 'Kaydediliyor…' : editingId ? 'Güncelle' : 'Kaydet'}
              </Button>
              <Button variant="secondary" onClick={resetForm}>
                İptal
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {loading ? (
        <LoadingState label="Katlar yükleniyor…" />
      ) : visibleFloors.length === 0 ? (
        <EmptyState
          title={floors.length === 0 ? 'Henüz kat yok' : 'Sonuç bulunamadı'}
          description={
            floors.length === 0
              ? 'Bu lokasyon için kat ekleyerek mağaza formlarında kullanılabilir hale getirin.'
              : 'Arama kriterlerinize uygun kat bulunamadı.'
          }
        />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Kod</th>
              <th style={{ padding: 8 }}>Etiket</th>
              <th style={{ padding: 8 }}>Durum</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {visibleFloors.map((floor) => (
              <tr key={floor.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 8 }}>{floor.name}</td>
                <td style={{ padding: 8 }}>{floor.label}</td>
                <td style={{ padding: 8 }}>{floor.active ? 'Aktif' : 'Pasif'}</td>
                <td style={{ padding: 8 }}>
                  {canEdit ? (
                    <>
                      <button type="button" onClick={() => moveFloor(floor.id, -1)} style={{ marginRight: 4 }}>↑</button>
                      <button type="button" onClick={() => moveFloor(floor.id, 1)} style={{ marginRight: 4 }}>↓</button>
                      <button type="button" onClick={() => openEdit(floor)} style={{ marginRight: 4 }}>Düzenle</button>
                      <button type="button" onClick={() => void toggleActive(floor)} style={{ marginRight: 4 }}>{floor.active ? 'Pasifleştir' : 'Aktifleştir'}</button>
                      <button type="button" onClick={() => void removeFloor(floor.id)} style={{ color: '#b91c1c' }}>Sil</button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
