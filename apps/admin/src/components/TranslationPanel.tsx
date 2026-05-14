import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

function stableDraftSignature(
  d: Record<string, Record<string, string>>,
  localeIds: string[],
  fieldList: string[],
): string {
  const sortedFields = [...fieldList].sort();
  const sortedLocs = [...localeIds].sort();
  return JSON.stringify(
    sortedLocs.flatMap((lid) => sortedFields.map((f) => [lid, f, d[lid]?.[f] ?? ''] as const)),
  );
}

/** Varsayılan dil sekmesi: tüm alanlar dolu olunca tamamlandı sayılır. */
function completionDefaultLocale(
  draftSlice: Record<string, string> | undefined,
  fieldList: string[],
): { pct: number; tone: 'complete' | 'partial' | 'none'; missing: string[] } {
  const slice = draftSlice ?? {};
  const missing: string[] = [];
  for (const f of fieldList) {
    if (!String(slice[f] ?? '').trim()) missing.push(FIELD_LABELS[f] ?? f);
  }
  const needed = fieldList.length;
  const filled = needed - missing.length;
  if (needed === 0) return { pct: 100, tone: 'complete', missing: [] };
  const pct = Math.round((filled / needed) * 100);
  if (missing.length === 0) return { pct: 100, tone: 'complete', missing: [] };
  if (filled === 0) return { pct: 0, tone: 'none', missing };
  return { pct, tone: 'partial', missing };
}

function completionNonDefault(
  loc: CmsLocale,
  defaultLoc: CmsLocale,
  fullDraft: Record<string, Record<string, string>>,
  fieldList: string[],
): { pct: number; tone: 'complete' | 'partial' | 'none'; missing: string[] } {
  const def = fullDraft[defaultLoc.id] ?? {};
  const slice = fullDraft[loc.id] ?? {};
  let needed = 0;
  let filled = 0;
  const missing: string[] = [];
  for (const f of fieldList) {
    if (!String(def[f] ?? '').trim()) continue;
    needed += 1;
    if (String(slice[f] ?? '').trim()) {
      filled += 1;
    } else {
      missing.push(FIELD_LABELS[f] ?? f);
    }
  }
  if (needed === 0) return { pct: 100, tone: 'complete', missing: [] };
  const pct = Math.round((filled / needed) * 100);
  if (missing.length === 0) return { pct: 100, tone: 'complete', missing: [] };
  if (filled === 0) return { pct: 0, tone: 'none', missing };
  return { pct, tone: 'partial', missing };
}

const badgeStyle = (tone: 'complete' | 'partial' | 'none'): CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  color: '#fff',
  background: tone === 'complete' ? '#059669' : tone === 'partial' ? '#d97706' : '#9ca3af',
});

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
  const baselineSigRef = useRef<string>('');

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
      const active = locList.filter((l) => l.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
      const firstId = active[0]?.id ?? null;
      setActiveLocaleId((prev) => {
        if (prev && active.some((l) => l.id === prev)) return prev;
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
      baselineSigRef.current = stableDraftSignature(
        nextDraft,
        locList.map((l) => l.id),
        fields,
      );
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

  const dirty = useMemo(() => {
    if (!baselineSigRef.current) return false;
    return (
      stableDraftSignature(draft, locales.map((l) => l.id), fields) !== baselineSigRef.current
    );
  }, [draft, locales, fields]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  if (!canRead) {
    return null;
  }

  if (!activeTenantId) {
    return null;
  }

  const tabLocales = locales.filter((l) => l.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const defaultLoc = locales.find((l) => l.isDefault);

  async function persistLocale(localeId: string): Promise<void> {
    if (!accessToken || !activeTenantId || !canWrite) return;
    const loc = locales.find((l) => l.id === localeId);
    if (!loc) return;
    const slice = draft[localeId] ?? {};
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
  }

  async function handleSaveLocale(localeId: string) {
    setSaving(true);
    try {
      await persistLocale(localeId);
      toast.success('Çeviriler kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAllLocales() {
    if (!accessToken || !activeTenantId || !canWrite) return;
    setSaving(true);
    try {
      for (const loc of tabLocales) {
        await persistLocale(loc.id);
      }
      toast.success('Tüm aktif diller kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  function handleCopyFromDefault(targetLocaleId: string) {
    if (!defaultLoc || targetLocaleId === defaultLoc.id) return;
    const src = draft[defaultLoc.id] ?? {};
    setDraft((d) => ({
      ...d,
      [targetLocaleId]: { ...d[targetLocaleId], ...Object.fromEntries(fields.map((f) => [f, src[f] ?? ''])) },
    }));
    toast.message('Varsayılan dil metinleri bu sekmeye kopyalandı (henüz kaydedilmedi)');
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

  const activeLoc = activeLocaleId ? locales.find((l) => l.id === activeLocaleId) : undefined;
  const isRtl = Boolean(activeLoc?.rtl || activeLoc?.code.toLowerCase() === 'ar');

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
      {dirty && (
        <p style={{ fontSize: 12, color: '#b45309', margin: '0 0 8px' }}>
          Kaydedilmemiş çeviri değişiklikleri var.
        </p>
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {loading && <LoadingState />}
      {!loading && tabLocales.length === 0 && (
        <p style={{ fontSize: 13, color: '#6b7280' }}>
          Aktif dil yok. Ayarlar → Yerelleştirme üzerinden en az bir dili etkinleştirin.
        </p>
      )}
      {!loading && tabLocales.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
            {tabLocales.map((loc) => {
              const stats =
                defaultLoc && loc.id !== defaultLoc.id
                  ? completionNonDefault(loc, defaultLoc, draft, fields)
                  : completionDefaultLocale(draft[loc.id], fields);
              return (
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
                  {loc.rtl && (
                    <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>RTL</span>
                  )}
                  <span style={badgeStyle(stats.tone)}>{stats.pct}%</span>
                </button>
              );
            })}
            {canWrite && tabLocales.length > 1 && (
              <Button variant="secondary" disabled={saving} onClick={() => void handleSaveAllLocales()}>
                {saving ? 'Kaydediliyor…' : 'Tüm dilleri kaydet'}
              </Button>
            )}
          </div>
          {activeLocaleId && activeLoc && (
            <div style={{ display: 'grid', gap: 12 }}>
              {defaultLoc &&
                activeLoc.id !== defaultLoc.id &&
                (() => {
                  const st = completionNonDefault(activeLoc, defaultLoc, draft, fields);
                  if (st.missing.length === 0) return null;
                  return (
                    <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>
                      Eksik: {st.missing.join(', ')}
                    </p>
                  );
                })()}
              {defaultLoc &&
                activeLoc.id === defaultLoc.id &&
                (() => {
                  const st = completionDefaultLocale(draft[activeLoc.id], fields);
                  if (st.missing.length === 0) return null;
                  return (
                    <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>
                      Zorunlu alanlar: {st.missing.join(', ')}
                    </p>
                  );
                })()}
              {defaultLoc && activeLoc.id !== defaultLoc.id && (
                <div>
                  <button
                    type="button"
                    disabled={!canWrite || saving}
                    onClick={() => handleCopyFromDefault(activeLoc.id)}
                    style={{
                      fontSize: 12,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#fff',
                      cursor: canWrite && !saving ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Varsayılan dil içeriğini bu dile kopyala
                  </button>
                </div>
              )}
              {fields.map((field) => {
                const multiline =
                  field === 'terms' ||
                  field === 'description' ||
                  field === 'shortDescription' ||
                  field === 'seoDescription';
                const rtlBox = {
                  ...inputStyle,
                  direction: isRtl ? 'rtl' : 'ltr',
                  textAlign: isRtl ? 'right' : 'left',
                } as const;
                return (
                  <div key={field}>
                    <label style={labelStyle}>{FIELD_LABELS[field] ?? field}</label>
                    {multiline ? (
                      <textarea
                        style={{
                          ...rtlBox,
                          minHeight: field === 'description' || field === 'terms' ? 80 : 52,
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
                    ) : (
                      <input
                        type="text"
                        style={{ ...rtlBox, minHeight: 44 }}
                        value={draft[activeLocaleId]?.[field] ?? ''}
                        disabled={!canWrite}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [activeLocaleId]: { ...d[activeLocaleId], [field]: e.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
              {canWrite ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <Button variant="primary" disabled={saving} onClick={() => void handleSaveLocale(activeLocaleId)}>
                    {saving ? 'Kaydediliyor…' : 'Bu dil için kaydet'}
                  </Button>
                  {!canDelete && (
                    <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>
                      Alanları tamamen boşaltmak için <code>translation:delete</code> yetkisi gerekir.
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#6b7280' }}>
                  Çeviri düzenlemek için <code>translation:create</code> yetkisi gerekir.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
