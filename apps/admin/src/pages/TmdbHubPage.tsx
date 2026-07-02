import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { Button } from '../components/ui/Button';
import { TmdbImportProgressPanel } from '../components/TmdbImportProgressPanel';
import {
  apiMovieImportBatchProgress,
  apiMovieSyncTrigger,
  apiTmdbBulkImport,
  apiTmdbImport,
  apiTmdbNowPlaying,
  apiTmdbPopular,
  apiTmdbSearch,
  apiTmdbUpcoming,
  type BulkImportPreview,
  type MovieImportBatchProgress,
  type TmdbListItem,
  type TmdbListResponse,
} from '../lib/api/movie-providers';

type TabId = 'now-playing' | 'upcoming' | 'popular' | 'search';

const TABS: Array<{ id: TabId; label: string; importAllLabel: string }> = [
  { id: 'now-playing', label: 'Vizyondakiler', importAllLabel: 'Vizyondakilerin Tamamını İçe Aktar' },
  { id: 'upcoming', label: 'Yakında Vizyonda', importAllLabel: 'Yakında Vizyondakilerin Tamamını İçe Aktar' },
  { id: 'popular', label: 'Popüler', importAllLabel: 'Popüler Filmleri İçe Aktar' },
  { id: 'search', label: 'Film Ara', importAllLabel: 'Arama Sonuçlarının Tamamını İçe Aktar' },
];

function countPreview(items: TmdbListItem[]): BulkImportPreview {
  const newMovies = items.filter((i) => i.importStatus === 'import').length;
  return {
    total: items.length,
    newMovies,
    updatedMovies: items.length - newMovies,
  };
}

function TmdbRow({
  item,
  selected,
  onToggle,
  onImport,
  importing,
  canCreate,
}: {
  item: TmdbListItem;
  selected: boolean;
  onToggle: (id: number) => void;
  onImport: (id: number) => void;
  importing: number | null;
  canCreate: boolean;
}) {
  return (
    <tr>
      <td style={{ padding: 8, width: 36 }}>
        {canCreate && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(item.tmdbId)}
            aria-label={`${item.title} seç`}
          />
        )}
      </td>
      <td style={{ padding: 8, width: 56 }}>
        {item.posterUrl ? (
          <img src={item.posterUrl} alt="" style={{ width: 40, height: 60, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 40, height: 60, background: '#e5e7eb', borderRadius: 4 }} />
        )}
      </td>
      <td style={{ padding: 8, fontWeight: 600 }}>{item.title}</td>
      <td style={{ padding: 8, fontSize: 13, color: '#6b7280' }}>{item.releaseDate ?? '—'}</td>
      <td style={{ padding: 8, fontSize: 12 }}>{item.genres.join(', ') || '—'}</td>
      <td style={{ padding: 8 }}>{item.tmdbVoteAverage?.toFixed(1) ?? '—'}</td>
      <td style={{ padding: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: item.importStatus === 'import' ? '#dbeafe' : '#fef3c7',
            color: item.importStatus === 'import' ? '#1e40af' : '#92400e',
          }}
        >
          {item.importStatus === 'import' ? 'Yeni' : 'Mevcut'}
        </span>
      </td>
      <td style={{ padding: 8 }}>
        {canCreate && (
          <Button
            size="sm"
            disabled={importing === item.tmdbId}
            onClick={() => onImport(item.tmdbId)}
          >
            {importing === item.tmdbId
              ? '…'
              : item.importStatus === 'import'
                ? '+ İçe Aktar'
                : 'Güncelle'}
          </Button>
        )}
      </td>
    </tr>
  );
}

function ConfirmBulkDialog({
  preview,
  onCancel,
  onConfirm,
  confirming,
}: {
  preview: BulkImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 16,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 8, maxWidth: 420, width: '100%', padding: 24 }}>
        <h3 style={{ margin: '0 0 12px' }}>Toplu içe aktarma</h3>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>{preview.total} film içe aktarılacak.</p>
        <p style={{ margin: '0 0 4px', fontSize: 14 }}>{preview.newMovies} yeni film oluşturulacak.</p>
        <p style={{ margin: '0 0 16px', fontSize: 14 }}>{preview.updatedMovies} mevcut film güncellenecek.</p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Devam etmek istiyor musunuz?</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel} disabled={confirming}>
            İptal
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Başlatılıyor…' : 'İçe Aktar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TmdbHubPage() {
  const { accessToken, activeTenantId } = useAuth();
  const { can } = usePermission();
  const canCreate = can('movie:create');

  const [tab, setTab] = useState<TabId>('now-playing');
  const [data, setData] = useState<TmdbListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQ, setSearchQ] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmPreview, setConfirmPreview] = useState<BulkImportPreview | null>(null);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [bulkStarting, setBulkStarting] = useState(false);
  const [importProgress, setImportProgress] = useState<MovieImportBatchProgress | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const currentTab = TABS.find((t) => t.id === tab)!;

  const visibleItems = useMemo(() => {
    const rows = data?.results ?? [];
    if (!genreFilter) return rows;
    return rows.filter((r) => r.genres.includes(genreFilter));
  }, [data?.results, genreFilter]);

  const genreOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of data?.results ?? []) {
      for (const g of row.genres) set.add(g);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [data?.results]);

  const stats = useMemo(() => {
    const total = visibleItems.length;
    const selectedItems = visibleItems.filter((i) => selected.has(i.tmdbId));
    const sel = selectedItems.length;
    return {
      total,
      selected: sel,
      newCount: visibleItems.filter((i) => i.importStatus === 'import').length,
      existingCount: visibleItems.filter((i) => i.importStatus === 'update').length,
      selectedNew: selectedItems.filter((i) => i.importStatus === 'import').length,
      selectedUpdate: selectedItems.filter((i) => i.importStatus === 'update').length,
    };
  }, [visibleItems, selected]);

  const fetchList = useCallback(async () => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    try {
      let res: TmdbListResponse;
      if (tab === 'now-playing') res = await apiTmdbNowPlaying(accessToken, activeTenantId, page);
      else if (tab === 'upcoming') res = await apiTmdbUpcoming(accessToken, activeTenantId, page);
      else if (tab === 'popular') res = await apiTmdbPopular(accessToken, activeTenantId, page);
      else {
        if (!searchQ.trim()) {
          setData({ page: 1, totalPages: 0, totalResults: 0, results: [] });
          setSelected(new Set());
          return;
        }
        res = await apiTmdbSearch(accessToken, activeTenantId, searchQ.trim(), page);
      }
      setData(res);
      setSelected(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, tab, page, searchQ]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
    setGenreFilter('');
  }, [tab]);

  const fetchListRef = useRef(fetchList);
  fetchListRef.current = fetchList;

  useEffect(() => {
    if (!accessToken || !activeTenantId || !activeBatchId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await apiMovieImportBatchProgress(accessToken, activeTenantId, activeBatchId);
        console.log('[MovieImport] Poll progress', res);
        if (cancelled) return;
        if (!res.found || !res.progress) return;
        setImportProgress(res.progress);
        if (res.progress.status === 'completed' || res.progress.status === 'failed') {
          setActiveBatchId(null);
          if (res.progress.status === 'completed') {
            const p = res.progress;
            const parts = [`${p.total} film işlendi`, `${p.newMovies} yeni`, `${p.updatedMovies} güncellendi`];
            if (p.failedMovies > 0) parts.push(`${p.failedMovies} hata`);
            toast.success(parts.join(' · '));
          } else {
            toast.error('Toplu içe aktarma başarısız');
          }
          void fetchListRef.current();
        }
      } catch {
        // ignore transient poll errors
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accessToken, activeTenantId, activeBatchId]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(visibleItems.map((i) => i.tmdbId)));
  };

  const clearSelection = () => setSelected(new Set());

  const openBulkConfirm = (ids: number[]) => {
    const items = visibleItems.filter((i) => ids.includes(i.tmdbId));
    setPendingIds(ids);
    setConfirmPreview(countPreview(items));
  };

  const handleBulkSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error('Lütfen en az bir film seçin');
      return;
    }
    openBulkConfirm(ids);
  };

  const handleBulkAllVisible = () => {
    if (visibleItems.length === 0) {
      toast.error('İçe aktarılacak film yok');
      return;
    }
    openBulkConfirm(visibleItems.map((i) => i.tmdbId));
  };

  const confirmBulkImport = async () => {
    if (!accessToken || !activeTenantId || pendingIds.length === 0) return;
    setBulkStarting(true);
    try {
      const res = await apiTmdbBulkImport(accessToken, activeTenantId, pendingIds);
      setConfirmPreview(null);
      setPendingIds([]);
      setSelected(new Set());
      setActiveBatchId(res.batchId);
      setImportProgress({
        batchId: res.batchId,
        tenantId: activeTenantId,
        status: 'queued',
        total: res.preview.total,
        processed: 0,
        newMovies: 0,
        updatedMovies: 0,
        failedMovies: 0,
        percent: 0,
      });
      toast.success('İçe aktarma başlatıldı.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBulkStarting(false);
    }
  };

  const handleImport = async (tmdbId: number) => {
    if (!accessToken || !activeTenantId || !canCreate) return;
    setImporting(tmdbId);
    try {
      const result = await apiTmdbImport(accessToken, activeTenantId, tmdbId);
      toast.success(result.created ? 'Film içe aktarıldı' : 'Film güncellendi');
      void fetchList();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(null);
    }
  };

  const handleSync = async () => {
    if (!accessToken || !activeTenantId || !can('movie:update')) return;
    setSyncing(true);
    try {
      await apiMovieSyncTrigger(accessToken, activeTenantId);
      toast.success('Senkronizasyon kuyruğa alındı');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((i) => selected.has(i.tmdbId));

  return (
    <PageContainer>
      <PageHeader
        title="TMDB Merkezi"
        subtitle="TMDB'den film keşfi ve içe aktarma"
        action={
          can('movie:update') ? (
            <Button onClick={() => void handleSync()} disabled={syncing}>
              {syncing ? 'Kuyruğa alınıyor…' : 'Şimdi Senkronize Et'}
            </Button>
          ) : undefined
        }
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: tab === t.id ? '#2563eb' : '#e5e7eb',
              background: tab === t.id ? '#eff6ff' : '#fff',
              color: tab === t.id ? '#1d4ed8' : '#374151',
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Film adı ara…"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6 }}
            onKeyDown={(e) => e.key === 'Enter' && void fetchList()}
          />
          <Button onClick={() => void fetchList()}>Ara</Button>
        </div>
      )}

      {!loading && visibleItems.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 10 }}>🎬 {currentTab.label}</div>

          {genreOptions.length > 0 && (
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Tür filtresi</label>
              <select
                value={genreFilter}
                onChange={(e) => {
                  setGenreFilter(e.target.value);
                  setSelected(new Set());
                }}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value="">Tümü</option>
                {genreOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#4b5563', marginBottom: 12 }}>
            <span>Toplam: <strong>{stats.total}</strong></span>
            <span>Seçili: <strong>{stats.selected}</strong></span>
            <span>Yeni: <strong>{stats.newCount}</strong></span>
            <span>Mevcut: <strong>{stats.existingCount}</strong></span>
          </div>

          {canCreate && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => (allVisibleSelected ? clearSelection() : selectAllVisible())}
                />
                Tümünü Seç
              </label>
              <Button size="sm" variant="secondary" onClick={handleBulkSelected} disabled={stats.selected === 0}>
                Seçilenleri İçe Aktar
              </Button>
              <Button size="sm" onClick={handleBulkAllVisible}>
                {currentTab.importAllLabel}
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: 8, width: 36 }} />
                <th style={{ padding: 8 }}>Poster</th>
                <th style={{ padding: 8 }}>Film Adı</th>
                <th style={{ padding: 8 }}>Vizyon Tarihi</th>
                <th style={{ padding: 8 }}>Türler</th>
                <th style={{ padding: 8 }}>TMDB Puanı</th>
                <th style={{ padding: 8 }}>Durum</th>
                <th style={{ padding: 8 }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <TmdbRow
                  key={item.tmdbId}
                  item={item}
                  selected={selected.has(item.tmdbId)}
                  onToggle={toggleSelect}
                  onImport={handleImport}
                  importing={importing}
                  canCreate={canCreate}
                />
              ))}
            </tbody>
          </table>

          {visibleItems.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              {tab === 'search' && !searchQ.trim() ? 'Aramak için bir film adı girin.' : 'Sonuç bulunamadı.'}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Önceki
              </Button>
              <span style={{ fontSize: 13, color: '#6b7280' }}>
                Sayfa {data.page} / {data.totalPages}
              </span>
              <Button size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Sonraki
              </Button>
            </div>
          )}
        </>
      )}

      {confirmPreview && (
        <ConfirmBulkDialog
          preview={confirmPreview}
          onCancel={() => {
            setConfirmPreview(null);
            setPendingIds([]);
          }}
          onConfirm={() => void confirmBulkImport()}
          confirming={bulkStarting}
        />
      )}

      <TmdbImportProgressPanel
        progress={importProgress}
        onDismiss={() => setImportProgress(null)}
      />
    </PageContainer>
  );
}
