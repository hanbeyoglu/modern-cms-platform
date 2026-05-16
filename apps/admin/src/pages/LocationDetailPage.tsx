import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { MultilingualContentFields, LOCATION_I18N_FIELDS } from '../components/MultilingualContentFields';
import { ContextualMediaPicker } from '../components/ContextualMediaPicker';
import {
  apiLocationGet,
  apiLocationUpdate,
  apiLocationUpdateStatus,
  apiLocationDelete,
  LOCATION_TYPE_LABELS,
  type CmsLocation,
  type LocationStatus,
  type LocationType,
  type UpdateLocationPayload,
  apiLocalesList,
  apiTranslationDelete,
  apiTranslationsList,
  apiTranslationUpsert,
  type CmsLocale,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { AuditTimeline } from '../components/AuditTimeline';
import { LinkedSliderGroupsSection } from '../components/LinkedSliderGroupsSection';

const STATUS_LABELS: Record<string, string> = {
  LIVE: 'Yayında', DRAFT: 'Taslak', MAINTENANCE: 'Bakımda', CLOSED: 'Kapalı',
};
const STATUS_COLORS: Record<string, string> = {
  LIVE: '#16a34a', DRAFT: '#d97706', MAINTENANCE: '#d97706', CLOSED: '#6b7280',
};

type Section = 'basic' | 'contact' | 'address' | 'geo' | 'hours' | 'social';

export function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [location, setLocation] = useState<CmsLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('basic');
  const [form, setForm] = useState<UpdateLocationPayload>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tenantLocales, setTenantLocales] = useState<CmsLocale[]>([]);
  const [contentLocaleTab, setContentLocaleTab] = useState<string | null>(null);
  const [localeDrafts, setLocaleDrafts] = useState<Record<string, Record<string, string>>>({});
  const [i18nDirty, setI18nDirty] = useState(false);

  const reload = () => {
    if (!accessToken || !id) return;
    setLoading(true);
    apiLocationGet(accessToken, id)
      .then((loc) => {
        setLocation(loc);
        setForm({
          name: loc.name, slug: loc.slug, type: loc.type,
          displayName: loc.displayName ?? '', legalName: loc.legalName ?? '',
          shortDescription: loc.shortDescription ?? '', description: loc.description ?? '',
          websiteUrl: loc.websiteUrl ?? '', supportEmail: loc.supportEmail ?? '', phone: loc.phone ?? '',
          addressLine1: loc.addressLine1 ?? '', addressLine2: loc.addressLine2 ?? '',
          city: loc.city ?? '', district: loc.district ?? '', country: loc.country ?? '', postalCode: loc.postalCode ?? '',
          latitude: loc.latitude ?? undefined, longitude: loc.longitude ?? undefined,
          timezone: loc.timezone ?? '',
          workingHoursJson: loc.workingHoursJson ?? '',
          socialLinksJson: loc.socialLinksJson ?? '',
          isPublic: loc.isPublic,
          logoMediaId: loc.logoMediaId ?? undefined,
          coverMediaId: loc.coverMediaId ?? undefined,
        });
        setDirty(false);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [accessToken, id]);

  useEffect(() => {
    if (!accessToken || !activeTenantId || !id || !location) {
      setTenantLocales([]);
      setContentLocaleTab(null);
      setLocaleDrafts({});
      return;
    }
    void (async () => {
      try {
        const locs = await apiLocalesList(accessToken, activeTenantId);
        setTenantLocales(locs);
        const activeLocales = locs.filter((l) => l.isActive);
        const defaultLocale = locs.find((l) => l.isDefault);
        setContentLocaleTab((prev) => {
          if (prev && activeLocales.some((l) => l.id === prev)) return prev;
          return defaultLocale?.id ?? activeLocales[0]?.id ?? null;
        });
        const translations = await apiTranslationsList(accessToken, activeTenantId, {
          entityType: 'LOCATION',
          entityId: id,
        });
        const drafts: Record<string, Record<string, string>> = {};
        for (const loc of activeLocales) {
          if (loc.id === defaultLocale?.id) continue;
          drafts[loc.id] = {
            displayName: '',
            shortDescription: '',
            description: '',
          };
          for (const field of LOCATION_I18N_FIELDS) {
            drafts[loc.id][field] =
              translations.find((row) => row.localeId === loc.id && row.field === field)?.value ?? '';
          }
        }
        setLocaleDrafts(drafts);
        setI18nDirty(false);
      } catch {
        setTenantLocales([]);
        setLocaleDrafts({});
      }
    })();
  }, [accessToken, activeTenantId, id, location?.id]);

  useEffect(() => {
    if (!location || (!dirty && !i18nDirty)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [location, dirty, i18nDirty]);

  const flushLocationTranslations = useCallback(
    async (locationId: string) => {
      if (!accessToken || !activeTenantId || !can('translation:create')) return;
      const defaultLocale = tenantLocales.find((l) => l.isDefault);
      const translations = await apiTranslationsList(accessToken, activeTenantId, {
        entityType: 'LOCATION',
        entityId: locationId,
      });
      const idByKey = new Map(translations.map((t) => [`${t.localeId}:${t.field}`, t.id] as const));
      for (const loc of tenantLocales.filter((l) => l.isActive)) {
        if (!defaultLocale || loc.id === defaultLocale.id) continue;
        const slice = localeDrafts[loc.id] ?? {};
        for (const field of LOCATION_I18N_FIELDS) {
          const value = (slice[field] ?? '').trim();
          const prevId = idByKey.get(`${loc.id}:${field}`);
          if (!value) {
            if (prevId && can('translation:delete')) {
              await apiTranslationDelete(accessToken, activeTenantId, prevId);
            }
            continue;
          }
          await apiTranslationUpsert(accessToken, activeTenantId, {
            localeCode: loc.code,
            entityType: 'LOCATION',
            entityId: locationId,
            field,
            value,
          });
        }
      }
    },
    [accessToken, activeTenantId, tenantLocales, localeDrafts, can],
  );

  const setField = (field: keyof UpdateLocationPayload, value: unknown) => {
    setForm((p) => ({ ...p, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!accessToken || !id) return;
    setSaving(true);
    try {
      const updated = await apiLocationUpdate(accessToken, id, form);
      await flushLocationTranslations(updated.id);
      toast.success('Lokasyon güncellendi');
      setDirty(false);
      setI18nDirty(false);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (status: LocationStatus) => {
    if (!accessToken || !id) return;
    if (!confirm(`Durum "${STATUS_LABELS[status]}" olarak değiştirilsin mi?`)) return;
    try {
      await apiLocationUpdateStatus(accessToken, id, status);
      toast.success('Durum güncellendi');
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async () => {
    if (!accessToken || !id) return;
    if (!confirm('Bu lokasyonu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) return;
    try {
      await apiLocationDelete(accessToken, id);
      toast.success('Lokasyon silindi');
      navigate('/locations');
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading) return <PageContainer><div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div></PageContainer>;
  if (!location) return <PageContainer><div style={{ color: '#dc2626' }}>Lokasyon bulunamadı</div></PageContainer>;

  const canEdit = can('location:update');
  const canDelete = can('location:delete');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4,
  };
  const fieldStyle: React.CSSProperties = { marginBottom: 14 };

  const sections: Array<{ id: Section; label: string }> = [
    { id: 'basic', label: 'Temel Bilgiler' },
    { id: 'contact', label: 'İletişim' },
    { id: 'address', label: 'Adres' },
    { id: 'geo', label: 'Konum' },
    { id: 'hours', label: 'Çalışma Saatleri' },
    { id: 'social', label: 'Sosyal Medya' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={location.displayName ?? location.name}
        subtitle={`${LOCATION_TYPE_LABELS[location.type] ?? location.type} · ${location.tenant?.name ?? ''}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {(dirty || i18nDirty) && canEdit && (
              <button onClick={handleSave} disabled={saving}
                style={{ padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            )}
            <button onClick={() => navigate('/locations')}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
              ← Geri
            </button>
          </div>
        }
      />

      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 12,
          fontSize: 12, fontWeight: 600,
          background: `${STATUS_COLORS[location.status] ?? '#9ca3af'}22`,
          color: STATUS_COLORS[location.status] ?? '#6b7280',
        }}>{STATUS_LABELS[location.status] ?? location.status}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>·</span>
        <span style={{ fontSize: 12, color: location.isPublic ? '#16a34a' : '#6b7280' }}>
          {location.isPublic ? 'Herkese Açık' : 'Gizli'}
        </span>
        {canEdit && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['LIVE', 'DRAFT', 'MAINTENANCE', 'CLOSED'] as LocationStatus[])
              .filter((s) => s !== location.status)
              .map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, cursor: 'pointer', background: '#fff', color: STATUS_COLORS[s] ?? '#374151' }}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
        {sections.map((s) => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            style={{
              padding: '8px 14px', border: 'none', borderBottom: activeSection === s.id ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none', fontSize: 13, fontWeight: activeSection === s.id ? 600 : 400,
              color: activeSection === s.id ? '#2563eb' : '#6b7280', cursor: 'pointer',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 24 }}>
        {activeSection === 'basic' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Ad *</label>
              <input style={inputStyle} value={form.name ?? ''} onChange={(e) => setField('name', e.target.value)} disabled={!canEdit} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Slug</label>
              <input style={inputStyle} value={form.slug ?? ''} onChange={(e) => setField('slug', e.target.value)} disabled={!canEdit} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Yasal Unvan</label>
              <input style={inputStyle} value={form.legalName ?? ''} onChange={(e) => setField('legalName', e.target.value)} disabled={!canEdit} />
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Tip</label>
              <select style={inputStyle} value={form.type ?? 'SHOPPING_MALL'} onChange={(e) => setField('type', e.target.value as LocationType)} disabled={!canEdit}>
                {Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              {tenantLocales.filter((l) => l.isActive).length > 0 && contentLocaleTab ? (
                <MultilingualContentFields
                  locales={tenantLocales}
                  fields={LOCATION_I18N_FIELDS}
                  activeLocaleId={contentLocaleTab}
                  onTabChange={(localeId) => setContentLocaleTab(localeId)}
                  defaultLocaleId={tenantLocales.find((l) => l.isDefault)?.id}
                  getValue={(localeId, field) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (defaultLocaleId && localeId === defaultLocaleId) {
                      return String(form[field as keyof UpdateLocationPayload] ?? '');
                    }
                    return localeDrafts[localeId]?.[field] ?? '';
                  }}
                  setValue={(localeId, field, value) => {
                    const defaultLocaleId = tenantLocales.find((l) => l.isDefault)?.id;
                    if (defaultLocaleId && localeId === defaultLocaleId) {
                      setField(field as keyof UpdateLocationPayload, value);
                      return;
                    }
                    setLocaleDrafts((drafts) => ({
                      ...drafts,
                      [localeId]: { ...drafts[localeId], [field]: value },
                    }));
                    setI18nDirty(true);
                  }}
                  onCopyFromDefault={(targetId) => {
                    setLocaleDrafts((drafts) => ({
                      ...drafts,
                      [targetId]: {
                        displayName: String(form.displayName ?? ''),
                        shortDescription: String(form.shortDescription ?? ''),
                        description: String(form.description ?? ''),
                      },
                    }));
                    setI18nDirty(true);
                  }}
                  disabled={!canEdit || saving}
                />
              ) : (
                <>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Görünen Ad</label>
                    <input
                      style={inputStyle}
                      value={form.displayName ?? ''}
                      onChange={(e) => setField('displayName', e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Kısa Açıklama</label>
                    <textarea
                      style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                      value={form.shortDescription ?? ''}
                      onChange={(e) => setField('shortDescription', e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Açıklama</label>
                    <textarea
                      style={{ ...inputStyle, height: 100, resize: 'vertical' }}
                      value={form.description ?? ''}
                      onChange={(e) => setField('description', e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </>
              )}
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Herkese Açık</label>
              <select style={inputStyle} value={form.isPublic ? 'true' : 'false'} onChange={(e) => setField('isPublic', e.target.value === 'true')} disabled={!canEdit}>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <ContextualMediaPicker
                context="LOCATION_LOGO"
                value={form.logoMediaId ?? ''}
                disabled={!canEdit}
                onChange={(id) => setField('logoMediaId', id || undefined)}
              />
            </div>
            <div style={fieldStyle}>
              <ContextualMediaPicker
                context="LOCATION_COVER"
                value={form.coverMediaId ?? ''}
                disabled={!canEdit}
                onChange={(id) => setField('coverMediaId', id || undefined)}
              />
            </div>
          </div>
        )}

        {activeSection === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {([
              ['phone', 'Telefon'],
              ['supportEmail', 'Destek E-posta'],
              ['websiteUrl', 'Web Sitesi'],
              ['timezone', 'Saat Dilimi'],
            ] as const).map(([field, label]) => (
              <div key={field} style={fieldStyle}>
                <label style={labelStyle}>{label}</label>
                <input style={inputStyle} value={(form as Record<string, string>)[field] ?? ''} onChange={(e) => setField(field, e.target.value)} disabled={!canEdit} />
              </div>
            ))}
          </div>
        )}

        {activeSection === 'address' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {([
              ['addressLine1', 'Adres Satırı 1', '1 / -1'],
              ['addressLine2', 'Adres Satırı 2', '1 / -1'],
              ['city', 'Şehir', '1'],
              ['district', 'İlçe', '1'],
              ['country', 'Ülke', '1'],
              ['postalCode', 'Posta Kodu', '1'],
            ] as const).map(([field, label, col]) => (
              <div key={field} style={{ ...fieldStyle, gridColumn: col === '1 / -1' ? '1 / -1' : undefined }}>
                <label style={labelStyle}>{label}</label>
                <input style={inputStyle} value={(form as Record<string, string>)[field] ?? ''} onChange={(e) => setField(field, e.target.value)} disabled={!canEdit} />
              </div>
            ))}
          </div>
        )}

        {activeSection === 'geo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Enlem (Latitude)</label>
              <input type="number" step="any" style={inputStyle}
                value={form.latitude ?? ''} onChange={(e) => setField('latitude', e.target.value ? parseFloat(e.target.value) : null)} disabled={!canEdit} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Boylam (Longitude)</label>
              <input type="number" step="any" style={inputStyle}
                value={form.longitude ?? ''} onChange={(e) => setField('longitude', e.target.value ? parseFloat(e.target.value) : null)} disabled={!canEdit} />
            </div>
            {form.latitude != null && form.longitude != null && (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                Koordinatlar: {form.latitude}, {form.longitude}
              </div>
            )}
          </div>
        )}

        {activeSection === 'hours' && (
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              Çalışma saatlerini JSON formatında girin. Örnek: {'{'}Mo-Fr: 10:00-22:00, Sa-Su: 10:00-23:00{'}'}
            </div>
            <textarea
              style={{ ...inputStyle, height: 160, fontFamily: 'monospace', fontSize: 12 }}
              value={typeof form.workingHoursJson === 'string' ? form.workingHoursJson : JSON.stringify(form.workingHoursJson ?? {}, null, 2)}
              onChange={(e) => setField('workingHoursJson', e.target.value)}
              disabled={!canEdit}
            />
          </div>
        )}

        {activeSection === 'social' && (
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              Sosyal medya bağlantılarını JSON formatında girin. Örnek: {'{'}instagram: "https://...", facebook: "https://..."{'}'}
            </div>
            <textarea
              style={{ ...inputStyle, height: 160, fontFamily: 'monospace', fontSize: 12 }}
              value={typeof form.socialLinksJson === 'string' ? form.socialLinksJson : JSON.stringify(form.socialLinksJson ?? {}, null, 2)}
              onChange={(e) => setField('socialLinksJson', e.target.value)}
              disabled={!canEdit}
            />
          </div>
        )}
      </div>

      {id && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '20px 24px',
            marginTop: 24,
          }}
        >
          <LinkedSliderGroupsSection entityType="LOCATION" entityId={id} />
        </div>
      )}

      {/* Danger zone */}
      {canDelete && (
        <div style={{ border: '1px solid #fecaca', borderRadius: 8, padding: 20, marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: 10 }}>Tehlikeli Bölge</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: '#374151' }}>Bu lokasyonu kalıcı olarak silin.</div>
            <button onClick={handleDelete}
              style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Lokasyonu Sil
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '20px 24px',
          marginTop: 24,
        }}
      >
        <AuditTimeline entityType="location" entityId={location.id} />
      </div>
    </PageContainer>
  );
}
