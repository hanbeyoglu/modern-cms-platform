import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import {
  apiMediaDelete,
  apiMediaList,
  apiMediaUpload,
  apiFoldersList,
  apiFolderCreate,
  type MediaAsset,
  type MediaFolder,
} from '../lib/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tenantId = activeTenantId;

  const loadAssets = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiMediaList(accessToken, tenantId, {
        folderId: activeFolderId,
        mallId: activeMallId ?? undefined,
      });
      setAssets(data.assets);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, activeFolderId, activeMallId]);

  const loadFolders = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const data = await apiFoldersList(accessToken, tenantId, {
        parentId: activeFolderId,
      });
      setFolders(data.folders ?? []);
    } catch {
      setFolders([]);
    }
  }, [accessToken, tenantId, activeFolderId]);

  useEffect(() => {
    void loadAssets();
    void loadFolders();
  }, [loadAssets, loadFolders]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken || !tenantId) return;
    setUploading(true);
    setUploadProgress(`Yükleniyor: ${file.name}…`);
    setError(null);
    try {
      await apiMediaUpload(accessToken, tenantId, file, {
        folderId: activeFolderId,
        mallId: activeMallId ?? undefined,
      });
      setUploadProgress(null);
      toast.success(`${file.name} yüklendi`);
      await loadAssets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız');
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm('Bu medya dosyasını silmek istediğinizden emin misiniz?')) return;
    try {
      await apiMediaDelete(accessToken, tenantId, id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => t - 1);
      toast.success('Dosya silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız');
    }
  }

  async function handleCreateFolder() {
    if (!accessToken || !tenantId || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const folder = await apiFolderCreate(accessToken, tenantId, newFolderName.trim(), activeFolderId);
      setFolders((prev) => [...prev, folder]);
      setNewFolderName('');
      toast.success('Klasör oluşturuldu');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Klasör oluşturulamadı');
    } finally {
      setCreatingFolder(false);
    }
  }

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Medya Kütüphanesi" />
        <EmptyState title="Tenant seçilmedi" description="Medya kütüphanesini kullanmak için üstten bir tenant seçin." />
      </PageContainer>
    );
  }

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <PageContainer>
      <PageHeader
        title="Medya Kütüphanesi"
        meta={<span style={{ fontSize: 12, color: '#6b7280' }}>{total} dosya{activeFolderId ? ' (klasör filtreli)' : ''}</span>}
      />
    <div style={{ fontSize: 13 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          {uploading ? 'Yükleniyor…' : 'Dosya Yükle'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/avif"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {activeFolderId && (
          <button
            type="button"
            onClick={() => setActiveFolderId(undefined)}
            style={{ fontSize: 13, padding: '4px 10px' }}
          >
            ↑ Üst Klasöre Çık
          </button>
        )}

      </div>

      {uploadProgress && (
        <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, marginBottom: 12, color: '#1e40af', fontSize: 13 }}>
          {uploadProgress}
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16 }}>
        {/* Folder sidebar */}
        <aside>
          <div
            style={{
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Klasörler</div>

            {/* Root folder entry */}
            <div
              onClick={() => setActiveFolderId(undefined)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                background: activeFolderId === undefined ? '#eff6ff' : 'transparent',
                marginBottom: 4,
              }}
            >
              📁 Tüm Dosyalar
            </div>

            {folders.map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveFolderId(f.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: activeFolderId === f.id ? '#eff6ff' : 'transparent',
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={f.name}
              >
                📁 {f.name}
              </div>
            ))}

            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
              <input
                type="text"
                placeholder="Yeni klasör adı"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleCreateFolder()}
                style={{ width: '100%', fontSize: 12, padding: '3px 6px', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => void handleCreateFolder()}
                disabled={creatingFolder || !newFolderName.trim()}
                style={{ marginTop: 6, fontSize: 12, width: '100%', padding: '3px 0' }}
              >
                {creatingFolder ? '…' : 'Klasör Oluştur'}
              </button>
            </div>
          </div>
        </aside>

        {/* Asset grid */}
        <main>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Yükleniyor…</p>
          ) : assets.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 40,
                border: '2px dashed #d1d5db',
                borderRadius: 8,
                color: '#6b7280',
              }}
            >
              <p>Henüz medya dosyası yok.</p>
              <p>Dosya yüklemek için "Dosya Yükle" butonuna tıklayın.</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 12,
              }}
            >
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      height: 100,
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {isImage(asset.mimeType) ? (
                      <img
                        src={asset.publicUrl}
                        alt={asset.altText ?? asset.originalName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <span style={{ fontSize: 28 }}>📄</span>
                    )}
                  </div>

                  {/* Meta */}
                  <div style={{ padding: '6px 8px' }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={asset.originalName}
                    >
                      {asset.originalName}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                      {formatBytes(asset.size)}
                      {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                    </div>
                    <div
                      style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}
                    >
                      <a
                        href={asset.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#2563eb' }}
                      >
                        Aç
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDelete(asset.id)}
                        style={{
                          fontSize: 11,
                          color: '#b91c1c',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
    </PageContainer>
  );
}
