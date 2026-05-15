import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth/useAuth';
import { apiMediaGet, apiMediaList, apiMediaUpload, type MediaAsset } from '../lib/api';
import { MEDIA_CONTEXTS, type MediaContextPreset, type MediaUsageContextKey } from '../lib/media-contexts';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Görsel boyutları okunamadı'));
    };
    img.src = url;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  context: MediaUsageContextKey;
  value: string;
  onChange: (mediaId: string) => void;
  mallId?: string;
  disabled?: boolean;
}

type ModalMode = 'library' | 'upload';

// ─── Overlay ─────────────────────────────────────────────────────────────────

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>,
    document.body,
  );
}

// ─── Library Browser ─────────────────────────────────────────────────────────

function LibraryBrowser({
  preset,
  mallId,
  onSelect,
  onClose,
}: {
  preset: MediaContextPreset;
  mallId?: string;
  onSelect: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const { accessToken, activeTenantId } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    try {
      const data = await apiMediaList(accessToken, activeTenantId, {
        mallId,
        mimeType: 'image',
        search: search || undefined,
        limit: 80,
      });
      setAssets(data.assets);
      setTotal(data.total);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, mallId, search]);

  useEffect(() => { void load(); }, [load]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val), 350);
  }

  const selectedAsset = highlighted ? assets.find((a) => a.id === highlighted) : null;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        width: '90vw',
        maxWidth: 860,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Medya Kütüphanesi</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
            {preset.label} · Önerilen: {preset.recommendedWidth}×{preset.recommendedHeight}px
          </div>
        </div>
        <input
          type="text"
          placeholder="Görselde ara…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            width: 200,
          }}
        />
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>Görsel bulunamadı.</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>{total} görsel</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
              }}
            >
              {assets.map((asset) => {
                const isSelected = highlighted === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setHighlighted(isSelected ? null : asset.id)}
                    style={{
                      border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                      borderRadius: 8,
                      background: isSelected ? '#eff6ff' : '#f9fafb',
                      padding: 0,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textAlign: 'left',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '4/3',
                        overflow: 'hidden',
                        background: '#e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={asset.publicUrl}
                        alt={asset.altText ?? asset.originalName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    </div>
                    <div style={{ padding: '5px 7px' }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: '#374151',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {asset.originalName}
                      </div>
                      {asset.width && asset.height && (
                        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
                          {asset.width}×{asset.height}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 18px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {selectedAsset && (
          <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>
            Seçili: <strong>{selectedAsset.originalName}</strong>
            {selectedAsset.width && selectedAsset.height && (
              <span style={{ color: '#6b7280' }}> ({selectedAsset.width}×{selectedAsset.height})</span>
            )}
          </span>
        )}
        {!selectedAsset && <span style={{ flex: 1 }} />}
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          İptal
        </button>
        <button
          type="button"
          disabled={!highlighted}
          onClick={() => { if (selectedAsset) onSelect(selectedAsset); }}
          style={{
            padding: '6px 16px',
            fontSize: 13,
            border: 'none',
            borderRadius: 6,
            background: highlighted ? '#2563eb' : '#d1d5db',
            color: '#fff',
            cursor: highlighted ? 'pointer' : 'not-allowed',
          }}
        >
          Seç
        </button>
      </div>
    </div>
  );
}

// ─── Upload Panel ─────────────────────────────────────────────────────────────

function UploadPanel({
  preset,
  mallId,
  onUploaded,
  onClose,
}: {
  preset: MediaContextPreset;
  mallId?: string;
  onUploaded: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const { accessToken, activeTenantId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Sadece görsel dosyaları kabul edilir.');
      return;
    }
    setError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    void getImageDimensions(f).then(setDims).catch(() => setDims(null));
  }

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  const tooSmall =
    dims != null &&
    (dims.width < preset.recommendedWidth || dims.height < preset.recommendedHeight);

  async function handleUpload() {
    if (!file || !accessToken || !activeTenantId) return;
    setUploading(true);
    setError(null);
    try {
      const tags = [preset.key];
      const asset = await apiMediaUpload(accessToken, activeTenantId, file, {
        mallId,
        altText: altText || undefined,
        usageContext: preset.key,
        suggestedWidth: preset.recommendedWidth,
        suggestedHeight: preset.recommendedHeight,
        tags,
      });
      onUploaded(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        width: '90vw',
        maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Yeni Görsel Yükle</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
            {preset.label} · Önerilen: {preset.recommendedWidth}×{preset.recommendedHeight}px
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 20 }}>
        {/* File drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
          style={{
            border: '2px dashed #d1d5db',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            cursor: 'pointer',
            background: '#f9fafb',
            marginBottom: 14,
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Önizleme"
              style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6, objectFit: 'contain' }}
            />
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
              <div style={{ fontSize: 13, color: '#374151' }}>Görsel seçmek için tıklayın</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                PNG, JPG, WebP, SVG · Önerilen: {preset.recommendedWidth}×{preset.recommendedHeight}px
              </div>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* File info */}
        {file && dims && (
          <div
            style={{
              fontSize: 12,
              color: '#374151',
              background: '#f3f4f6',
              borderRadius: 6,
              padding: '7px 10px',
              marginBottom: 12,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span>{file.name}</span>
            <span>{formatBytes(file.size)}</span>
            <span>{dims.width}×{dims.height}px</span>
          </div>
        )}

        {/* Dimension warning */}
        {tooSmall && (
          <div
            style={{
              fontSize: 12,
              color: '#92400e',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 6,
              padding: '7px 10px',
              marginBottom: 12,
            }}
          >
            Uyarı: Görsel önerilen boyuttan ({preset.recommendedWidth}×{preset.recommendedHeight}px) küçük.
            Kalite düşük görünebilir. Yine de yükleyebilirsiniz.
          </div>
        )}

        {/* Alt text */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
            Alt Metin (opsiyonel)
          </label>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Görsel açıklaması..."
            style={{
              width: '100%',
              padding: '5px 8px',
              fontSize: 13,
              border: '1px solid #d1d5db',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              fontSize: 12,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              padding: '7px 10px',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          İptal
        </button>
        <button
          type="button"
          disabled={!file || uploading}
          onClick={() => void handleUpload()}
          style={{
            padding: '6px 16px',
            fontSize: 13,
            border: 'none',
            borderRadius: 6,
            background: file && !uploading ? '#2563eb' : '#d1d5db',
            color: '#fff',
            cursor: file && !uploading ? 'pointer' : 'not-allowed',
          }}
        >
          {uploading ? 'Yükleniyor…' : 'Yükle'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContextualMediaPicker({ context, value, onChange, mallId, disabled }: Props) {
  const { accessToken, activeTenantId } = useAuth();
  const preset = MEDIA_CONTEXTS[context];

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [currentAsset, setCurrentAsset] = useState<MediaAsset | null>(null);
  const [loadingAsset, setLoadingAsset] = useState(false);

  // Fetch the currently selected asset for preview
  useEffect(() => {
    if (!value || !accessToken || !activeTenantId) {
      setCurrentAsset(null);
      return;
    }
    let cancelled = false;
    setLoadingAsset(true);
    apiMediaGet(accessToken, activeTenantId, value)
      .then((a) => { if (!cancelled) setCurrentAsset(a); })
      .catch(() => { if (!cancelled) setCurrentAsset(null); })
      .finally(() => { if (!cancelled) setLoadingAsset(false); });
    return () => { cancelled = true; };
  }, [value, accessToken, activeTenantId]);

  function handleSelect(asset: MediaAsset) {
    setCurrentAsset(asset);
    onChange(asset.id);
    setModalMode(null);
  }

  function handleClear() {
    setCurrentAsset(null);
    onChange('');
  }

  const containerStyle: React.CSSProperties = {
    border: '1px solid #d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
    background: disabled ? '#f9fafb' : '#fff',
    opacity: disabled ? 0.7 : 1,
  };

  const headerStyle: React.CSSProperties = {
    padding: '6px 10px',
    background: '#f3f4f6',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  return (
    <>
      <div style={containerStyle}>
        {/* Context header */}
        <div style={headerStyle}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', flex: 1 }}>{preset.label}</span>
          <span
            style={{
              fontSize: 10,
              color: '#6b7280',
              background: '#e5e7eb',
              borderRadius: 4,
              padding: '1px 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {preset.recommendedWidth}×{preset.recommendedHeight}px
          </span>
        </div>

        {/* Preview area */}
        <div style={{ padding: 10 }}>
          {loadingAsset ? (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>
              Yükleniyor…
            </div>
          ) : currentAsset ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img
                src={currentAsset.publicUrl}
                alt={currentAsset.altText ?? currentAsset.originalName}
                style={{
                  width: 80,
                  height: 56,
                  objectFit: 'cover',
                  borderRadius: 5,
                  border: '1px solid #e5e7eb',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentAsset.originalName}
                </div>
                {currentAsset.width && currentAsset.height && (
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {currentAsset.width}×{currentAsset.height}px · {formatBytes(currentAsset.size)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              style={{
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontSize: 12,
                border: '1px dashed #d1d5db',
                borderRadius: 6,
                background: '#f9fafb',
              }}
            >
              Görsel seçilmedi
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          style={{
            padding: '8px 10px',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setModalMode('library')}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 5,
              background: '#fff',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: '#374151',
            }}
          >
            Kütüphaneden Seç
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setModalMode('upload')}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              border: '1px solid #2563eb',
              borderRadius: 5,
              background: '#eff6ff',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: '#2563eb',
            }}
          >
            Yeni Yükle
          </button>
          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={handleClear}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                border: '1px solid #fecaca',
                borderRadius: 5,
                background: '#fef2f2',
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: '#b91c1c',
              }}
            >
              Kaldır
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {modalMode === 'library' && (
        <Overlay onClose={() => setModalMode(null)}>
          <LibraryBrowser
            preset={preset}
            mallId={mallId}
            onSelect={handleSelect}
            onClose={() => setModalMode(null)}
          />
        </Overlay>
      )}
      {modalMode === 'upload' && (
        <Overlay onClose={() => setModalMode(null)}>
          <UploadPanel
            preset={preset}
            mallId={mallId}
            onUploaded={handleSelect}
            onClose={() => setModalMode(null)}
          />
        </Overlay>
      )}
    </>
  );
}
