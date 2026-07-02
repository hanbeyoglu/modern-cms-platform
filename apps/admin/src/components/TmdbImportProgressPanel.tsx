import type { MovieImportBatchProgress } from '../lib/api/movie-providers';

type Props = {
  progress: MovieImportBatchProgress | null;
  onDismiss: () => void;
};

export function TmdbImportProgressPanel({ progress, onDismiss }: Props) {
  if (!progress) return null;

  const pct =
    progress.percent ??
    (progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0);
  const done = progress.status === 'completed' || progress.status === 'failed';
  const barFilled = Math.round((pct / 100) * 12);
  const bar = '█'.repeat(barFilled) + '░'.repeat(12 - barFilled);

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        width: 280,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 16,
        zIndex: 100,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>TMDB İçe Aktarma</strong>
        {done && (
          <button
            type="button"
            onClick={onDismiss}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}
            aria-label="Kapat"
          >
            ×
          </button>
        )}
      </div>

      {!done ? (
        <>
          <div style={{ marginBottom: 6, color: '#374151' }}>
            {progress.processed} / {progress.total}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 6, color: '#2563eb' }}>{bar}</div>
          <div style={{ color: '#6b7280' }}>{pct}%</div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 4, color: '#374151' }}>
          <div>{progress.total} film işlendi</div>
          <div style={{ color: '#065f46' }}>{progress.newMovies} yeni</div>
          <div style={{ color: '#92400e' }}>{progress.updatedMovies} güncellendi</div>
          <div style={{ color: progress.failedMovies > 0 ? '#b91c1c' : '#6b7280' }}>
            {progress.failedMovies} hata
          </div>
        </div>
      )}
    </div>
  );
}
