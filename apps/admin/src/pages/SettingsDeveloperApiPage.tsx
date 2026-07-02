import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  apiDevAnalyticsGet,
  apiDevDomainAdd,
  apiDevDomainRemove,
  apiDevDomainsGet,
  apiDevKeyCreate,
  apiDevKeyDelete,
  apiDevKeyRegenerate,
  apiDevKeyRevoke,
  apiDevKeysGet,
  apiDevKeyUpdate,
  apiDevLogsGet,
  apiDevRateLimitGet,
  apiDevRateLimitUpdate,
  type ApiAnalytics,
  type ApiKey,
  type ApiKeyEnvironment,
  type ApiRequestLog,
  type AllowedDomain,
  type RateLimitConfig,
} from '../lib/api/developer-api';

type Tab = 'keys' | 'domains' | 'rate-limit' | 'sdk' | 'logs';

const ENV_LABELS: Record<ApiKeyEnvironment, string> = {
  PRODUCTION: 'Production',
  STAGING: 'Staging',
  DEVELOPMENT: 'Development',
};

const ENV_COLORS: Record<ApiKeyEnvironment, string> = {
  PRODUCTION: '#166534',
  STAGING: '#92400e',
  DEVELOPMENT: '#1e40af',
};

const ENV_BG: Record<ApiKeyEnvironment, string> = {
  PRODUCTION: '#dcfce7',
  STAGING: '#fef3c7',
  DEVELOPMENT: '#dbeafe',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#166534',
  INACTIVE: '#6b7280',
  REVOKED: '#991b1b',
};

const STATUS_BG: Record<string, string> = {
  ACTIVE: '#dcfce7',
  INACTIVE: '#f3f4f6',
  REVOKED: '#fee2e2',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
  REVOKED: 'İptal Edildi',
};

const RATE_LIMIT_PRESETS = [100, 500, 1000, 5000];

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: '2px 8px', borderRadius: 10 }}>
      {label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: copied ? '#16a34a' : '#f3f4f6', color: copied ? '#fff' : '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}
    >
      {copied ? 'Kopyalandı!' : 'Kopyala'}
    </button>
  );
}

// ── Modal: Show raw key once ──────────────────────────────────────────────────

function RawKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 20 }}>🔑</span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>API Key Oluşturuldu</h2>
        </div>
        <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          ⚠ Bu anahtar yalnızca bir kez gösterilmektedir. Lütfen güvenli bir yere kaydedin.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
          <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all', color: '#1e293b', fontFamily: 'monospace' }}>{rawKey}</code>
          <CopyButton text={rawKey} />
        </div>
        <button
          onClick={onClose}
          style={{ width: '100%', padding: '10px 0', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Anladım, kapattım
        </button>
      </div>
    </div>
  );
}

// ── Tab: API Keys ─────────────────────────────────────────────────────────────

function ApiKeysTab({ token, tenantId, canEdit }: { token: string; tenantId: string; canEdit: boolean }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEnv, setNewEnv] = useState<ApiKeyEnvironment>('PRODUCTION');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiDevKeysGet(token, tenantId)
      .then(setKeys)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token, tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('İsim gerekli'); return; }
    setCreating(true);
    try {
      const result = await apiDevKeyCreate(token, tenantId, { name: newName.trim(), description: newDesc.trim() || undefined, environment: newEnv });
      setRawKey(result.rawKey);
      setNewName(''); setNewDesc(''); setShowForm(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Bu API key\'i iptal etmek istediğinizden emin misiniz?')) return;
    try {
      await apiDevKeyRevoke(token, tenantId, keyId);
      toast.success('API Key iptal edildi');
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleRegenerate = async (keyId: string, name: string) => {
    if (!confirm(`"${name}" key\'ini yenilemek istediğinizden emin misiniz? Mevcut key geçersiz olacak.`)) return;
    try {
      const result = await apiDevKeyRegenerate(token, tenantId, keyId);
      setRawKey(result.rawKey);
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleToggleStatus = async (key: ApiKey) => {
    const next = key.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiDevKeyUpdate(token, tenantId, key.id, { status: next });
      toast.success(`Key ${next === 'ACTIVE' ? 'aktif' : 'pasif'} yapıldı`);
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async (keyId: string, name: string) => {
    if (!confirm(`"${name}" key\'ini silmek istediğinizden emin misiniz?`)) return;
    try {
      await apiDevKeyDelete(token, tenantId, keyId);
      toast.success('API Key silindi');
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      {rawKey && <RawKeyModal rawKey={rawKey} onClose={() => setRawKey(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          Public API erişimi için API key'leri yönetin. Key yalnızca oluşturulduğunda gösterilir.
        </p>
        {canEdit && (
          <button
            onClick={() => setShowForm((p) => !p)}
            style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Yeni Key
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20, background: '#fafafa' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Yeni API Key Oluştur</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>İsim *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Web sitesi, Mobil uygulama…"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Ortam</label>
              <select
                value={newEnv}
                onChange={(e) => setNewEnv(e.target.value as ApiKeyEnvironment)}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              >
                <option value="PRODUCTION">Production</option>
                <option value="STAGING">Staging</option>
                <option value="DEVELOPMENT">Development</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Açıklama (opsiyonel)</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Bu key ne için kullanılacak?"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={creating} style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {creating ? 'Oluşturuluyor…' : 'Oluştur'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              İptal
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : keys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          Henüz API key yok
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {keys.map((key) => (
            <div key={key.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{key.name}</span>
                    <Badge label={ENV_LABELS[key.environment]} color={ENV_COLORS[key.environment]} bg={ENV_BG[key.environment]} />
                    <Badge label={STATUS_LABELS[key.status] ?? key.status} color={STATUS_COLORS[key.status] ?? '#374151'} bg={STATUS_BG[key.status] ?? '#f3f4f6'} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <code style={{ fontSize: 12, color: '#475569', background: '#f8fafc', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                      {key.keyPrefix}••••••••••••••••
                    </code>
                  </div>
                  {key.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{key.description}</p>}
                  <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
                    Oluşturuldu: {new Date(key.createdAt).toLocaleDateString('tr-TR')}
                    {key.lastUsedAt && ` · Son kullanım: ${new Date(key.lastUsedAt).toLocaleDateString('tr-TR')}`}
                    {key.revokedAt && ` · İptal: ${new Date(key.revokedAt).toLocaleDateString('tr-TR')}`}
                  </div>
                </div>
                {canEdit && key.status !== 'REVOKED' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggleStatus(key)}
                      style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}
                    >
                      {key.status === 'ACTIVE' ? 'Pasif Yap' : 'Aktif Yap'}
                    </button>
                    <button
                      onClick={() => handleRegenerate(key.id, key.name)}
                      style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Yenile
                    </button>
                    <button
                      onClick={() => handleRevoke(key.id)}
                      style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}
                    >
                      İptal Et
                    </button>
                    <button
                      onClick={() => handleDelete(key.id, key.name)}
                      style={{ padding: '5px 10px', fontSize: 11, fontWeight: 600, background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Sil
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Allowed Domains ──────────────────────────────────────────────────────

function AllowedDomainsTab({ token, tenantId, canEdit }: { token: string; tenantId: string; canEdit: boolean }) {
  const [domains, setDomains] = useState<AllowedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiDevDomainsGet(token, tenantId)
      .then(setDomains)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token, tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const d = newDomain.trim().toLowerCase();
    if (!d) { toast.error('Domain gerekli'); return; }
    setAdding(true);
    try {
      await apiDevDomainAdd(token, tenantId, d);
      setNewDomain('');
      toast.success('Domain eklendi');
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setAdding(false); }
  };

  const handleRemove = async (id: string, domain: string) => {
    if (!confirm(`"${domain}" domainini kaldırmak istediğinizden emin misiniz?`)) return;
    try {
      await apiDevDomainRemove(token, tenantId, id);
      toast.success('Domain kaldırıldı');
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
        Public API isteklerinin kabul edileceği domain'leri tanımlayın. Boş bırakılırsa tüm origin'lere izin verilir.
        Wildcard (<code>*</code>) desteklenmez.
      </p>

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd(); }}
            placeholder="örn: www.emaar.com.tr, localhost"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {adding ? '…' : 'Ekle'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : domains.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🌐</div>
          Domain eklenmemiş — tüm origin'lere izin veriliyor
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {domains.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, color: '#374151' }}>🌐</span>
                <code style={{ fontSize: 13, color: '#111827', fontFamily: 'monospace' }}>{d.domain}</code>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(d.createdAt).toLocaleDateString('tr-TR')}</span>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleRemove(d.id, d.domain)}
                  style={{ padding: '4px 10px', fontSize: 11, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Kaldır
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Rate Limits ──────────────────────────────────────────────────────────

function RateLimitsTab({ token, tenantId, canEdit }: { token: string; tenantId: string; canEdit: boolean }) {
  const [config, setConfig] = useState<RateLimitConfig>({ requestsPerMinute: 500 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiDevRateLimitGet(token, tenantId)
      .then((c) => { setConfig(c); setCustom(!RATE_LIMIT_PRESETS.includes(c.requestsPerMinute)); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token, tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await apiDevRateLimitUpdate(token, tenantId, config.requestsPerMinute);
      setConfig(result);
      setSaved(true);
      toast.success('Rate limit güncellendi');
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>;

  return (
    <div style={{ maxWidth: 480 }}>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
        Tenant bazlı API rate limit. Bu limit tek bir API key için değil, tenant'ın tüm Public API trafiği için geçerlidir.
      </p>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 24, background: '#fff' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 12 }}>
          İstek / Dakika
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {RATE_LIMIT_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => { setConfig({ requestsPerMinute: preset }); setCustom(false); setSaved(false); }}
              disabled={!canEdit}
              style={{
                padding: '10px 0', fontSize: 14, fontWeight: 700,
                background: config.requestsPerMinute === preset && !custom ? '#2563eb' : '#f3f4f6',
                color: config.requestsPerMinute === preset && !custom ? '#fff' : '#374151',
                border: '1px solid #e5e7eb', borderRadius: 7, cursor: canEdit ? 'pointer' : 'default',
              }}
            >
              {preset.toLocaleString()}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: canEdit ? 'pointer' : 'default', marginBottom: 8 }}>
            <input type="checkbox" checked={custom} onChange={(e) => { setCustom(e.target.checked); setSaved(false); }} disabled={!canEdit} />
            Özel değer gir
          </label>
          {custom && (
            <input
              type="number"
              min={10}
              max={100000}
              value={config.requestsPerMinute}
              onChange={(e) => { setConfig({ requestsPerMinute: parseInt(e.target.value, 10) || 500 }); setSaved(false); }}
              disabled={!canEdit}
              style={{ width: 160, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, fontWeight: 700 }}
            />
          )}
        </div>

        <div style={{ padding: '12px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#0369a1' }}>
            Mevcut limit: <strong>{config.requestsPerMinute.toLocaleString()} istek/dakika</strong>
            {' '}· Aşıldığında <code>429 Too Many Requests</code> döner.
          </p>
        </div>

        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#16a34a' }}>✓ Kaydedildi</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: SDK ──────────────────────────────────────────────────────────────────

function SdkTab({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<'js' | 'react' | 'nextjs' | 'reactnative'>('js');

  const samples: Record<typeof tab, string> = {
    js: `import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'pk_live_••••••••••••••••••••••••••••••••',
  tenantId: '${tenantId}',
  mallId: 'your-mall-id',      // opsiyonel
  defaultLocale: 'tr',
});

// Mağazaları getir
const stores = await cms.getStores({ locale: 'tr', limit: 20 });

// Ana sayfa verisi
const home = await cms.getHomePage('tr');

// Slider'ları getir
const sliders = await cms.getSliders({ locale: 'tr', channel: 'WEB' });`,

    react: `import { useEffect, useState } from 'react';
import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: process.env.REACT_APP_CMS_BASE_URL,
  apiKey: process.env.REACT_APP_CMS_API_KEY,
  tenantId: '${tenantId}',
  mallId: process.env.REACT_APP_MALL_ID,
  defaultLocale: 'tr',
});

function StoreList() {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    cms.getStores({ locale: 'tr' })
      .then(res => setStores(res.data.items));
  }, []);

  return stores.map(s => <div key={s.id}>{s.name}</div>);
}`,

    nextjs: `// lib/cms.ts
import { CmsPublicClient } from '@modern-cms/public-sdk';

export const cms = new CmsPublicClient({
  baseUrl: process.env.NEXT_PUBLIC_CMS_BASE_URL!,
  apiKey: process.env.CMS_API_KEY!,          // server-side only
  tenantId: '${tenantId}',
  mallId: process.env.NEXT_PUBLIC_MALL_ID,
  defaultLocale: 'tr',
});

// app/page.tsx (Server Component)
import { cms } from '@/lib/cms';

export default async function HomePage() {
  const home = await cms.getHomePage('tr');
  return <main>{home.data.sliders.length} slider</main>;
}`,

    reactnative: `import { CmsPublicClient } from '@modern-cms/public-sdk';

const cms = new CmsPublicClient({
  baseUrl: 'https://api.example.com',
  apiKey: 'pk_live_••••••••••••••••••••••••••••••••',
  tenantId: '${tenantId}',
  mallId: 'your-mall-id',
  defaultLocale: 'tr',
  fetchImpl: fetch,  // React Native 0.72+ built-in fetch
});

// Kampanyaları getir
const campaigns = await cms.getCampaigns({ locale: 'tr', limit: 10 });`,
  };

  const TAB_LABELS: Record<typeof tab, string> = { js: 'JavaScript', react: 'React', nextjs: 'Next.js', reactnative: 'React Native' };

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
        <code>@modern-cms/public-sdk</code> paketini projenize ekleyerek Public API'yi kolayca kullanabilirsiniz.
      </p>

      <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <code style={{ fontSize: 13, color: '#475569' }}>npm install @modern-cms/public-sdk</code>
          <CopyButton text="npm install @modern-cms/public-sdk" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '2px solid #e5e7eb' }}>
        {(Object.keys(TAB_LABELS) as (typeof tab)[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? '#2563eb' : '#6b7280',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <pre style={{ margin: 0, padding: 20, background: '#1e293b', color: '#e2e8f0', fontSize: 12, borderRadius: '0 0 8px 8px', overflowX: 'auto', lineHeight: 1.6, fontFamily: 'monospace' }}>
          {samples[tab]}
        </pre>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <CopyButton text={samples[tab]} />
        </div>
      </div>

      <div style={{ marginTop: 20, padding: '14px 16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#92400e', fontWeight: 500 }}>
          ⚠ <strong>Güvenlik:</strong> <code>apiKey</code> değerini client-side kodda açıkça yazmaktan kaçının.
          Next.js'te server-side env değişkeni (<code>CMS_API_KEY</code>) kullanın.
          Public API key'ler yalnızca izin verilen domain'lerden gelen istekleri kabul eder.
        </p>
      </div>
    </div>
  );
}

// ── Tab: API Logs ─────────────────────────────────────────────────────────────

function ApiLogsTab({ token, tenantId }: { token: string; tenantId: string }) {
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ApiAnalytics | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiDevLogsGet(token, tenantId, { limit: 100 }),
      apiDevAnalyticsGet(token, tenantId),
    ])
      .then(([l, a]) => { setLogs(l); setAnalytics(a); })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [token, tenantId]);

  const statusColor = (code: number) => code < 300 ? '#16a34a' : code < 400 ? '#0284c7' : code < 500 ? '#d97706' : '#dc2626';

  if (loading) return <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>;

  return (
    <div>
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Bugün', value: analytics.todayRequests.toLocaleString(), icon: '📊' },
            { label: 'Başarısız (7g)', value: analytics.failedRequests.toLocaleString(), icon: '⚠' },
            { label: 'Top Endpoint', value: analytics.topEndpoints[0]?.endpoint?.replace('/public/', '') ?? '—', icon: '🔥' },
            { label: 'Son Kullanım', value: analytics.lastUsedKey ? new Date(analytics.lastUsedKey.lastUsedAt).toLocaleDateString('tr-TR') : '—', icon: '🕐' },
          ].map((stat) => (
            <div key={stat.label} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px', background: '#fff' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          Henüz API isteği yok
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px 80px 140px 120px', padding: '8px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Tarih</span>
            <span>Endpoint</span>
            <span>Status</span>
            <span>Süre</span>
            <span>Origin</span>
            <span>API Key</span>
          </div>
          {logs.map((log) => (
            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px 80px 140px 120px', padding: '10px 16px', borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#374151', alignItems: 'center', background: '#fff' }}>
              <span style={{ color: '#9ca3af', fontSize: 11 }}>
                {new Date(log.createdAt).toLocaleString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <code style={{ fontFamily: 'monospace', color: '#1e293b', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.method} {log.endpoint}
              </code>
              <span style={{ fontWeight: 700, color: statusColor(log.statusCode) }}>{log.statusCode}</span>
              <span style={{ color: log.responseTimeMs > 500 ? '#d97706' : '#374151' }}>{log.responseTimeMs}ms</span>
              <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.origin ?? undefined}>
                {log.origin ?? '—'}
              </span>
              <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>
                {log.apiKey ? `${log.apiKey.keyPrefix}…` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function SettingsDeveloperApiPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();
  const [activeTab, setActiveTab] = useState<Tab>('keys');

  const canEdit = can('settings:update');

  if (!accessToken || !activeTenantId) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'keys', label: 'API Keys' },
    { id: 'domains', label: 'İzinli Domain\'ler' },
    { id: 'rate-limit', label: 'Rate Limit' },
    { id: 'sdk', label: 'SDK' },
    { id: 'logs', label: 'API Logları' },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Developer API"
        subtitle="Public API erişimi, key yönetimi ve kullanım izleme"
      />

      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 24, display: 'flex', gap: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'keys' && <ApiKeysTab token={accessToken} tenantId={activeTenantId} canEdit={canEdit} />}
      {activeTab === 'domains' && <AllowedDomainsTab token={accessToken} tenantId={activeTenantId} canEdit={canEdit} />}
      {activeTab === 'rate-limit' && <RateLimitsTab token={accessToken} tenantId={activeTenantId} canEdit={canEdit} />}
      {activeTab === 'sdk' && <SdkTab tenantId={activeTenantId} />}
      {activeTab === 'logs' && <ApiLogsTab token={accessToken} tenantId={activeTenantId} />}
    </PageContainer>
  );
}
