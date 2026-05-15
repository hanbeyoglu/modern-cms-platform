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
  apiMediaUpdate,
  apiMediaMove,
  apiMediaUsages,
  apiFoldersList,
  apiFolderCreate,
  apiFolderUpdate,
  apiFolderDelete,
  type MediaAsset,
  type MediaFolder,
  type MediaUsage,
} from '../lib/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

// ─── Asset Detail Drawer ──────────────────────────────────────────────────────

function AssetDrawer({
  asset,
  folders,
  onClose,
  onUpdated,
  onDeleted,
  accessToken,
  tenantId,
}: {
  asset: MediaAsset;
  folders: MediaFolder[];
  onClose: () => void;
  onUpdated: (updated: MediaAsset) => void;
  onDeleted: (id: string) => void;
  accessToken: string;
  tenantId: string;
}) {
  const [tab, setTab] = useState<'details' | 'usages'>('details');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [usages, setUsages] = useState<MediaUsage[] | null>(null);
  const [loadingUsages, setLoadingUsages] = useState(false);

  const [altText, setAltText] = useState(asset.altText ?? '');
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [description, setDescription] = useState(asset.description ?? '');
  const [tagsInput, setTagsInput] = useState(asset.tags.join(', '));
  const [focalX, setFocalX] = useState(asset.focalPointX != null ? String(asset.focalPointX) : '');
  const [focalY, setFocalY] = useState(asset.focalPointY != null ? String(asset.focalPointY) : '');
  const [moveFolderId, setMoveFolderId] = useState<string>(asset.folderId ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setAltText(asset.altText ?? '');
    setCaption(asset.caption ?? '');
    setDescription(asset.description ?? '');
    setTagsInput(asset.tags.join(', '));
    setFocalX(asset.focalPointX != null ? String(asset.focalPointX) : '');
    setFocalY(asset.focalPointY != null ? String(asset.focalPointY) : '');
    setMoveFolderId(asset.folderId ?? '');
    setUsages(null);
    setTab('details');
  }, [asset.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = await apiMediaUpdate(accessToken, tenantId, asset.id, {
        altText: altText || undefined,
        caption: caption || undefined,
        description: description || undefined,
        tags,
        focalPointX: focalX !== '' ? parseFloat(focalX) : undefined,
        focalPointY: focalY !== '' ? parseFloat(focalY) : undefined,
      });
      onUpdated(updated);
      toast.success('Medya güncellendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  }

  async function handleMove() {
    setMoving(true);
    try {
      const updated = await apiMediaMove(
        accessToken,
        tenantId,
        asset.id,
        moveFolderId || null,
      );
      onUpdated(updated);
      toast.success('Dosya taşındı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Taşıma başarısız');
    } finally {
      setMoving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiMediaDelete(accessToken, tenantId, asset.id);
      onDeleted(asset.id);
      toast.success('Dosya silindi');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız');
      setDeleting(false);
    }
  }

  async function loadUsages() {
    setLoadingUsages(true);
    try {
      const data = await apiMediaUsages(accessToken, tenantId, asset.id);
      setUsages(data);
    } catch {
      setUsages([]);
    } finally {
      setLoadingUsages(false);
    }
  }

  function handleTabChange(t: 'details' | 'usages') {
    setTab(t);
    if (t === 'usages' && usages === null) void loadUsages();
  }

  function copyUrl() {
    void navigator.clipboard.writeText(asset.publicUrl);
    toast.success('URL kopyalandı');
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 3,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 13,
    padding: '5px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'relative',
          width: 420,
          background: '#fff',
          height: '100%',
          overflowY: 'auto',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.originalName}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div
          style={{
            height: 180,
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
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: 48 }}>📄</span>
          )}
        </div>

        {/* File info bar */}
        <div
          style={{
            padding: '8px 16px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 11,
            color: '#6b7280',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>{asset.mimeType}</span>
          <span>{formatBytes(asset.size)}</span>
          {asset.width && asset.height && <span>{asset.width}×{asset.height}px</span>}
          {asset.durationSeconds && <span>{asset.durationSeconds.toFixed(1)}s</span>}
        </div>

        {/* URL row */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            readOnly
            value={asset.publicUrl}
            style={{ ...inputStyle, color: '#6b7280', fontSize: 11, flex: 1 }}
          />
          <button
            type="button"
            onClick={copyUrl}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Kopyala
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {(['details', 'usages'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTabChange(t)}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: 12,
                fontWeight: tab === t ? 600 : 400,
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
                cursor: 'pointer',
                color: tab === t ? '#2563eb' : '#6b7280',
              }}
            >
              {t === 'details' ? 'Detaylar' : 'Kullanım'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: 16, flex: 1 }}>
          {tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Alt Text</label>
                <input
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Görüntü açıklaması (erişilebilirlik)"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Başlık (Caption)</label>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Görüntü altı yazısı"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detaylı açıklama"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Etiketler (virgülle ayırın)</label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="örn: banner, hero, sezon"
                  style={inputStyle}
                />
                {asset.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {asset.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          borderRadius: 99,
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {isImage(asset.mimeType) && (
                <div>
                  <label style={labelStyle}>Odak Noktası (0.0 – 1.0)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <input
                        value={focalX}
                        onChange={(e) => setFocalX(e.target.value)}
                        placeholder="X (0-1)"
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        value={focalY}
                        onChange={(e) => setFocalY(e.target.value)}
                        placeholder="Y (0-1)"
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 16px',
                  fontSize: 13,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>

              {/* Move to folder */}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                <label style={labelStyle}>Klasöre Taşı</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={moveFolderId}
                    onChange={(e) => setMoveFolderId(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">— Kök Klasör —</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleMove()}
                    disabled={moving}
                    style={{
                      padding: '5px 12px',
                      fontSize: 12,
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: moving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {moving ? '…' : 'Taşı'}
                  </button>
                </div>
              </div>

              {/* Delete */}
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      background: 'none',
                      border: '1px solid #fca5a5',
                      color: '#b91c1c',
                      borderRadius: 4,
                      padding: '5px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Dosyayı Sil
                  </button>
                ) : (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#b91c1c' }}>
                      Bu dosyayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 12px',
                          fontSize: 12,
                          cursor: deleting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {deleting ? 'Siliniyor…' : 'Evet, Sil'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        style={{
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          padding: '4px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'usages' && (
            <div>
              {loadingUsages ? (
                <p style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</p>
              ) : usages === null ? null : usages.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: 32,
                    color: '#6b7280',
                    fontSize: 13,
                  }}
                >
                  Bu dosya hiçbir yerde kullanılmıyor.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {usages.map((u, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        padding: '8px 12px',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{u.entityName}</div>
                      <div style={{ color: '#6b7280' }}>
                        <span
                          style={{
                            background: '#f3f4f6',
                            borderRadius: 3,
                            padding: '1px 5px',
                            marginRight: 6,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {u.entityType}
                        </span>
                        Alan: <strong>{u.field}</strong>
                      </div>
                      {u.route && (
                        <div style={{ marginTop: 4, fontSize: 11, color: '#2563eb' }}>
                          {u.route}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main MediaPage ───────────────────────────────────────────────────────────

export function MediaPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [allFolders, setAllFolders] = useState<MediaFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMime, setFilterMime] = useState('');

  // Folder management state
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

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
        search: searchQuery || undefined,
        mimeType: filterMime || undefined,
      });
      setAssets(data.assets);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Medya yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, activeFolderId, activeMallId, searchQuery, filterMime]);

  const loadFolders = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const [current, all] = await Promise.all([
        apiFoldersList(accessToken, tenantId, { parentId: activeFolderId }),
        apiFoldersList(accessToken, tenantId, {}),
      ]);
      setFolders(current.folders ?? []);
      setAllFolders(all.folders ?? []);
    } catch {
      setFolders([]);
      setAllFolders([]);
    }
  }, [accessToken, tenantId, activeFolderId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken || !tenantId) return;
    setUploading(true);
    setUploadProgress(`Yükleniyor: ${file.name}…`);
    setError(null);
    try {
      const uploaded = await apiMediaUpload(accessToken, tenantId, file, {
        folderId: activeFolderId,
        mallId: activeMallId ?? undefined,
      });
      setAssets((prev) => [uploaded, ...prev]);
      setTotal((t) => t + 1);
      setUploadProgress(null);
      toast.success(`${file.name} yüklendi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yükleme başarısız');
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleCreateFolder() {
    if (!accessToken || !tenantId || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const folder = await apiFolderCreate(accessToken, tenantId, newFolderName.trim(), activeFolderId);
      setFolders((prev) => [...prev, folder]);
      setAllFolders((prev) => [...prev, folder]);
      setNewFolderName('');
      toast.success('Klasör oluşturuldu');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Klasör oluşturulamadı');
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRenameFolder(id: string) {
    if (!accessToken || !tenantId || !renamingValue.trim()) return;
    try {
      const updated = await apiFolderUpdate(accessToken, tenantId, id, { name: renamingValue.trim() });
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setAllFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setRenamingFolderId(null);
      toast.success('Klasör yeniden adlandırıldı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yeniden adlandırma başarısız');
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    if (!accessToken || !tenantId) return;
    if (!window.confirm(`"${name}" klasörünü silmek istediğinizden emin misiniz? Klasör boş olmalıdır.`)) return;
    try {
      await apiFolderDelete(accessToken, tenantId, id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setAllFolders((prev) => prev.filter((f) => f.id !== id));
      if (activeFolderId === id) setActiveFolderId(undefined);
      toast.success('Klasör silindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silme başarısız');
    }
  }

  function handleAssetUpdated(updated: MediaAsset) {
    setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (selectedAsset?.id === updated.id) setSelectedAsset(updated);
  }

  function handleAssetDeleted(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setTotal((t) => t - 1);
    if (selectedAsset?.id === id) setSelectedAsset(null);
  }

  if (!tenantId) {
    return (
      <PageContainer>
        <PageHeader title="Medya Kütüphanesi" />
        <EmptyState title="Tenant seçilmedi" description="Medya kütüphanesini kullanmak için üstten bir tenant seçin." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Medya Kütüphanesi"
        meta={
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {total} dosya{activeFolderId ? ' (klasör filtreli)' : ''}
          </span>
        }
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
              fontWeight: 600,
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

          {/* Search */}
          <input
            type="text"
            placeholder="Dosya ara…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              fontSize: 12,
              padding: '5px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              width: 180,
            }}
          />

          {/* Mime filter */}
          <select
            value={filterMime}
            onChange={(e) => setFilterMime(e.target.value)}
            style={{
              fontSize: 12,
              padding: '5px 8px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          >
            <option value="">Tüm Türler</option>
            <option value="image/">Görseller</option>
            <option value="image/svg">SVG</option>
            <option value="image/gif">GIF</option>
            <option value="image/webp">WebP</option>
            <option value="video/">Videolar</option>
          </select>

          {/* View toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid görünümü"
              style={{
                padding: '4px 8px',
                fontSize: 14,
                background: viewMode === 'grid' ? '#eff6ff' : 'transparent',
                border: `1px solid ${viewMode === 'grid' ? '#2563eb' : '#d1d5db'}`,
                borderRadius: 4,
                cursor: 'pointer',
                color: viewMode === 'grid' ? '#2563eb' : '#6b7280',
              }}
            >
              ⊞
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Liste görünümü"
              style={{
                padding: '4px 8px',
                fontSize: 14,
                background: viewMode === 'list' ? '#eff6ff' : 'transparent',
                border: `1px solid ${viewMode === 'list' ? '#2563eb' : '#d1d5db'}`,
                borderRadius: 4,
                cursor: 'pointer',
                color: viewMode === 'list' ? '#2563eb' : '#6b7280',
              }}
            >
              ☰
            </button>
          </div>
        </div>

        {uploadProgress && (
          <div
            style={{
              padding: '8px 12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 6,
              marginBottom: 12,
              color: '#1e40af',
              fontSize: 13,
            }}
          >
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
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                Klasörler
              </div>

              {/* Root */}
              <div
                onClick={() => setActiveFolderId(undefined)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: activeFolderId === undefined ? '#eff6ff' : 'transparent',
                  marginBottom: 2,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: activeFolderId === undefined ? '#2563eb' : 'inherit',
                  fontWeight: activeFolderId === undefined ? 600 : 400,
                }}
              >
                📁 Tüm Dosyalar
              </div>

              {folders.map((f) => (
                <div key={f.id}>
                  {renamingFolderId === f.id ? (
                    <div style={{ padding: '3px 4px' }}>
                      <input
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleRenameFolder(f.id);
                          if (e.key === 'Escape') setRenamingFolderId(null);
                        }}
                        autoFocus
                        style={{ width: '100%', fontSize: 11, padding: '2px 4px', boxSizing: 'border-box' }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '5px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: activeFolderId === f.id ? '#eff6ff' : 'transparent',
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        color: activeFolderId === f.id ? '#2563eb' : 'inherit',
                        fontWeight: activeFolderId === f.id ? 600 : 400,
                      }}
                      title={f.name}
                    >
                      <span
                        onClick={() => setActiveFolderId(f.id)}
                        style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        📁 {f.name}
                      </span>
                      <button
                        type="button"
                        title="Yeniden adlandır"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingFolderId(f.id);
                          setRenamingValue(f.name);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 10,
                          color: '#9ca3af',
                          flexShrink: 0,
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        title="Sil"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteFolder(f.id, f.name);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 10,
                          color: '#9ca3af',
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* New folder input */}
              <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                <input
                  type="text"
                  placeholder="Yeni klasör adı"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleCreateFolder()}
                  style={{ width: '100%', fontSize: 11, padding: '3px 6px', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  disabled={creatingFolder || !newFolderName.trim()}
                  style={{ marginTop: 5, fontSize: 11, width: '100%', padding: '3px 0' }}
                >
                  {creatingFolder ? '…' : 'Klasör Oluştur'}
                </button>
              </div>
            </div>
          </aside>

          {/* Asset area */}
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
                <p style={{ margin: '0 0 8px', fontSize: 24 }}>📂</p>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
                  {searchQuery || filterMime ? 'Sonuç bulunamadı' : 'Henüz medya dosyası yok'}
                </p>
                <p style={{ margin: 0, fontSize: 12 }}>
                  {searchQuery || filterMime
                    ? 'Farklı bir arama veya filtre deneyin.'
                    : '"Dosya Yükle" butonuna tıklayın veya buraya sürükleyin.'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
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
                    onClick={() => setSelectedAsset(asset)}
                    style={{
                      border: `1px solid ${selectedAsset?.id === asset.id ? '#2563eb' : '#e5e7eb'}`,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#fff',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                  >
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
                      {asset.tags.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {asset.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: 9,
                                padding: '1px 5px',
                                background: '#f0fdf4',
                                color: '#166534',
                                borderRadius: 99,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List view
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: 40 }} />
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Dosya Adı</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Tür</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Boyut</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Etiketler</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: selectedAsset?.id === asset.id ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '6px 12px' }}>
                        {isImage(asset.mimeType) ? (
                          <img
                            src={asset.publicUrl}
                            alt=""
                            style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 3 }}
                          />
                        ) : (
                          <span style={{ fontSize: 20 }}>📄</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 12px', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.originalName}
                        </div>
                        {asset.altText && (
                          <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {asset.altText}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#6b7280' }}>{asset.mimeType}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {formatBytes(asset.size)}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {asset.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: 9,
                                padding: '1px 5px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                borderRadius: 99,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(asset.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </main>
        </div>
      </div>

      {/* Asset detail drawer */}
      {selectedAsset && accessToken && tenantId && (
        <AssetDrawer
          asset={selectedAsset}
          folders={allFolders}
          onClose={() => setSelectedAsset(null)}
          onUpdated={handleAssetUpdated}
          onDeleted={handleAssetDeleted}
          accessToken={accessToken}
          tenantId={tenantId}
        />
      )}
    </PageContainer>
  );
}
