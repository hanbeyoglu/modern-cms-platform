import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ErrorBanner } from './ui/ErrorBanner';
import { LoadingState } from './ui/LoadingState';
import {
  apiLocalesList,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  type CmsLocale,
  type LocalizedContentRow,
  type LocalizedEntityType,
} from '../lib/api';

const FIELD_LABELS: Record<string, string> = {
  title: 'Başlık',
  seoTitle: 'SEO başlığı',
  seoDescription: 'SEO açıklaması',
  subtitle: 'Alt başlık',
  description: 'Açıklama',
  shortDescription: 'Kısa açıklama',
  buttonText: 'Buton metni',
  terms: 'Şartlar',
};

type Props = {
  entityType: LocalizedEntityType;
  entityId: string;
  fields: string[];
  title: string;
};

export function TranslationPanel({ entityType, entityId, fields, title }: Props) {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();

  const canRead = can('translation:read');
  const canWrite = can('translation:create');
  const canDelete = can('translation:delete');

  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [rows, setRows] = useState<LocalizedContentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLocaleId, setActiveLocaleId] = useState<string | null>(null);
  /** localeId -> field -> value (düzenlenen metin) */
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId || !entityId || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [locList, trList] = await Promise.all([
        apiLocalesList(accessToken, activeTenantId),
        apiTranslationsList(accessToken, activeTenantId, { entityType, entityId }),
      ]);
      setLocales(locList);
      setRows(trList);
      const active = locList.filter((l) => l.isActive);
      const firstId = active[0]?.id ?? locList[0]?.id ?? null;
      setActiveLocaleId((prev) => {
        if (prev && locList.some((l) => l.id === prev)) return prev;
        return firstId;
      });
      const nextDraft: Record<string, Record<string, string>> = {};
      for (const loc of locList) {
        nextDraft[loc.id] = {};
        for (const f of fields) {
          const hit = trList.find((t) => t.localeId === loc.id && t.field === f);
          nextDraft[loc.id][f] = hit?.value ?? '';
        }
      }
      setDraft(nextDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Çeviriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, entityId, entityType, fields, canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  const idByLocaleField = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of rows) {
      m.set(`${t.localeId}:${t.field}`, t.id);
    }
    return m;
  }, [rows]);

  if (!canRead) {
    return null;
  }

  if (!activeTenantId) {
    return null;
  }

  const activeLocales = locales.filter((l) => l.isActive);
  const tabLocales = activeLocales.length > 0 ? activeLocales : locales;

  async function handleSaveLocale(localeId: string) {
    if (!accessToken || !activeTenantId || !canWrite) return;
    const loc = locales.find((l) => l.id === localeId);
    if (!loc) return;
    const slice = draft[localeId] ?? {};
    setSaving(true);
    try {
      for (const field of fields) {
        const value = (slice[field] ?? '').trim();
        const prevId = idByLocaleField.get(`${localeId}:${field}`);
        if (!value) {
          if (prevId && canDelete) {
            await apiTranslationDelete(accessToken, activeTenantId, prevId);
          }
          continue;
        }
        await apiTranslationUpsert(accessToken, activeTenantId, {
          localeCode: loc.code,
          entityType,
          entityId,
          field,
          value,
        });
      }
      toast.success('Çeviriler kaydedildi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  const labelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
        background: '#fafafa',
      }}
    >
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>{title}</h4>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {loading && <LoadingState />}
      {!loading && tabLocales.length === 0 && (
        <p style={{ fontSize: 13, color: '#6b7280' }}>Aktif dil yok. Önce tenant için dil ekleyin.</p>
      )}
      {!loading && tabLocales.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {tabLocales.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setActiveLocaleId(loc.id)}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: activeLocaleId === loc.id ? '2px solid #2563eb' : '1px solid #d1d5db',
                  background: activeLocaleId === loc.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 600 }}>{loc.code}</span>
                {loc.isDefault && <Badge variant="blue">Varsayılan</Badge>}
              </button>
            ))}
          </div>
          {activeLocaleId && (
            <div style={{ display: 'grid', gap: 12 }}>
              {fields.map((field) => (
                <div key={field}>
                  <label style={labelStyle}>{FIELD_LABELS[field] ?? field}</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight:
                        field === 'terms' ||
                        field === 'description' ||
                        field === 'shortDescription' ||
                        field === 'seoDescription'
                          ? 80
                          : 44,
                      resize: 'vertical',
                    }}
                    value={draft[activeLocaleId]?.[field] ?? ''}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [activeLocaleId]: { ...d[activeLocaleId], [field]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
              {canWrite ? (
                <div>
                  <Button variant="primary" disabled={saving} onClick={() => void handleSaveLocale(activeLocaleId)}>
                    {saving ? 'Kaydediliyor…' : 'Bu dil için kaydet'}
                  </Button>
                  {!canDelete && (
                    <p style={{ fontSize: 11, color: '#92400e', marginTop: 8 }}>
                      Alanları tamamen boşaltmak için <code>translation:delete</code> yetkisi gerekir.
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#6b7280' }}>Çeviri düzenlemek için <code>translation:create</code> yetkisi gerekir.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
