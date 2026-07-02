import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  apiTenantDelete,
  apiTenantDeletePreview,
  type TenantDeleteMode,
  type TenantDeletePreview,
  type TenantDeleteResult,
} from '../lib/api';

type Props = {
  tenantId: string;
  accessToken: string;
  onClose: () => void;
  onDeleted: (result: TenantDeleteResult) => void;
};

const COUNT_LABELS: Array<[keyof TenantDeletePreview['counts'], string]> = [
  ['malls', 'Lokasyon'],
  ['users', 'Kullanıcı'],
  ['mallStores', 'Mağaza'],
  ['campaigns', 'Kampanya'],
  ['events', 'Etkinlik'],
  ['media', 'Medya'],
  ['movies', 'Film'],
  ['movieSessions', 'Seans'],
  ['sliders', 'Slider'],
  ['popups', 'Popup'],
  ['pages', 'Sayfa'],
  ['services', 'Hizmet'],
];

export function TenantDeleteModal({ tenantId, accessToken, onClose, onDeleted }: Props) {
  const [preview, setPreview] = useState<TenantDeletePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [mode, setMode] = useState<TenantDeleteMode>('SOFT');
  const [confirmSlug, setConfirmSlug] = useState('');

  useEffect(() => {
    setLoading(true);
    apiTenantDeletePreview(accessToken, tenantId)
      .then(setPreview)
      .catch((e: Error) => {
        toast.error(e.message);
        onClose();
      })
      .finally(() => setLoading(false));
  }, [accessToken, tenantId, onClose]);

  const canConfirm = preview && confirmSlug.trim() === preview.confirmHint && !preview.isProtected;

  const handleDelete = async () => {
    if (!preview || !canConfirm) return;
    setDeleting(true);
    try {
      const result = await apiTenantDelete(accessToken, tenantId, { mode, confirmSlug: confirmSlug.trim() });
      onDeleted(result);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 560, maxWidth: '100%',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#991b1b' }}>Müşteriyi Sil</div>
          <div style={{ fontSize: 13, color: '#b91c1c', marginTop: 4 }}>
            Bu işlem geri alınamaz. Devam etmeden önce aşağıdaki bilgileri inceleyin.
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: 13 }}>Önizleme yükleniyor…</div>
          ) : preview ? (
            <>
              <div style={{
                border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16,
                background: '#f9fafb',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{preview.tenant.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{preview.tenant.slug}</div>
              </div>

              {preview.isProtected && (
                <div style={{
                  padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 16,
                }}>
                  Bu müşteri sistem tenant olarak korunuyor ve silinemez.
                </div>
              )}

              {preview.isActorOnlyTenant && (
                <div style={{
                  padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a',
                  borderRadius: 8, fontSize: 13, color: '#92400e', marginBottom: 16,
                }}>
                  Bu tenant sizin tek üyeliğiniz. Silme işleminden sonra bu tenant&apos;a erişiminiz kalmayacak.
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase' }}>
                Silinecek Veriler
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px',
                fontSize: 13, marginBottom: 20,
              }}>
                {COUNT_LABELS.map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>{preview.counts[key]}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Silme Modu</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{
                    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: mode === 'SOFT' ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: mode === 'SOFT' ? '#eff6ff' : '#fff',
                  }}>
                    <input type="radio" checked={mode === 'SOFT'} onChange={() => setMode('SOFT')} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Yumuşak Sil (Önerilen)</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Tenant devre dışı bırakılır, veriler korunur. Kullanıcılar giriş yapamaz.
                      </div>
                    </div>
                  </label>
                  <label style={{
                    display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    border: mode === 'HARD' ? '2px solid #dc2626' : '1px solid #e5e7eb',
                    background: mode === 'HARD' ? '#fef2f2' : '#fff',
                  }}>
                    <input type="radio" checked={mode === 'HARD'} onChange={() => setMode('HARD')} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#dc2626' }}>Kalıcı Sil (Tehlikeli)</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        Tenant ve tüm ilişkili veriler kalıcı olarak silinir. Geri alınamaz.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Onaylamak için slug yazın: <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{preview.confirmHint}</code>
                </label>
                <input
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  placeholder={preview.confirmHint}
                  disabled={preview.isProtected}
                  style={{
                    width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
                    borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                  }}
                />
              </div>
            </>
          ) : null}
        </div>

        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm || deleting || loading}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 13,
              fontWeight: 600, cursor: canConfirm && !deleting ? 'pointer' : 'not-allowed',
              background: mode === 'HARD' ? '#dc2626' : '#2563eb',
              color: '#fff', opacity: canConfirm && !deleting ? 1 : 0.5,
            }}
          >
            {deleting ? 'Siliniyor…' : mode === 'HARD' ? 'Kalıcı Olarak Sil' : 'Müşteriyi Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}
