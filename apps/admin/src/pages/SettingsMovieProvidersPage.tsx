import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import {
  apiMovieProvidersSettingsGet,
  apiMovieProvidersSettingsUpdateTmdb,
  apiMovieSyncLogs,
  type TmdbProviderSettings,
  type MovieSyncLog,
} from '../lib/api/movie-providers';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';

export function SettingsMovieProvidersPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();
  const [form, setForm] = useState<TmdbProviderSettings>({
    readAccessToken: '',
    language: 'tr-TR',
    region: 'TR',
    posterSize: 'w500',
    syncEnabled: true,
    cronTime: '03:00',
  });
  const [logs, setLogs] = useState<MovieSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    Promise.all([
      apiMovieProvidersSettingsGet(accessToken, activeTenantId),
      apiMovieSyncLogs(accessToken, activeTenantId),
    ])
      .then(([settings, logRes]) => {
        setForm(settings.movieProviders.tmdb);
        setLogs(logRes.logs);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, activeTenantId]);

  const handleSave = async () => {
    if (!accessToken || !activeTenantId) return;
    setSaving(true);
    try {
      const data = await apiMovieProvidersSettingsUpdateTmdb(accessToken, activeTenantId, form);
      setForm(data.movieProviders.tmdb);
      toast.success('Film sağlayıcı ayarları kaydedildi');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const canEdit = can('settings:update');
  const lastSync = form.lastSync;

  const fields: Array<{ key: keyof TmdbProviderSettings; label: string; type?: string }> = [
    { key: 'readAccessToken', label: 'Read Access Token' },
    { key: 'language', label: 'Language (varsayılan)' },
    { key: 'region', label: 'Region' },
    { key: 'posterSize', label: 'Poster Size' },
    { key: 'cronTime', label: 'Cron Time (HH:mm)' },
  ];

  return (
    <PageContainer>
      <PageHeader title="Film Sağlayıcıları" subtitle="TMDB entegrasyon ayarları" />

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : (
        <div style={{ maxWidth: 640 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>TMDB</h3>
          {form.readAccessTokenSource === 'env' && (
            <div style={{ fontSize: 12, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
              Token <code>TMDB_API_READ_ACCESS_TOKEN</code> ortam değişkeninden kullanılıyor.
            </div>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            {fields.map(({ key, label, type }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>
                  {label}
                </label>
                <input
                  type={type ?? (key === 'readAccessToken' ? 'password' : 'text')}
                  value={String(form[key] ?? '')}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6 }}
                />
              </div>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.syncEnabled}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, syncEnabled: e.target.checked }))}
              />
              Sync Enabled
            </label>
          </div>

          {lastSync && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 24, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Son Senkronizasyon</div>
              <div>Durum: {lastSync.status ?? '—'}</div>
              <div>Yeni: {lastSync.newMovies ?? 0} · Güncellenen: {lastSync.updatedMovies ?? 0} · Hata: {lastSync.errors ?? 0}</div>
              {lastSync.finishedAt && <div style={{ color: '#6b7280' }}>{new Date(lastSync.finishedAt).toLocaleString('tr-TR')}</div>}
            </div>
          )}

          {canEdit && (
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          )}

          {logs.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Senkronizasyon Geçmişi</h3>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: 6 }}>Başlangıç</th>
                    <th style={{ padding: 6 }}>Durum</th>
                    <th style={{ padding: 6 }}>Yeni</th>
                    <th style={{ padding: 6 }}>Güncellenen</th>
                    <th style={{ padding: 6 }}>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: 6 }}>{new Date(log.startedAt).toLocaleString('tr-TR')}</td>
                      <td style={{ padding: 6 }}>{log.status}</td>
                      <td style={{ padding: 6 }}>{log.newMovies}</td>
                      <td style={{ padding: 6 }}>{log.updatedMovies}</td>
                      <td style={{ padding: 6 }}>{log.failedMovies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
