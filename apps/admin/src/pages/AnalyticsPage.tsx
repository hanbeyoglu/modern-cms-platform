import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { Button } from '../components/ui/Button';
import {
  apiAnalyticsSummary,
  apiAnalyticsTopContent,
  apiAnalyticsTimeseries,
} from '../lib/api';
import type {
  AnalyticsSummary,
  AnalyticsTimeseriesRow,
  AnalyticsTopRow,
} from '../lib/api';

const ENTITY_TYPES = [
  'PAGE',
  'SLIDER',
  'EVENT',
  'CAMPAIGN',
  'STORE',
  'CINEMA',
  'MOVIE',
  'MOVIE_SESSION',
  'FORM',
  'CUSTOM',
] as const;

const EVENT_TYPES = [
  'PAGE_VIEW',
  'SLIDER_VIEW',
  'SLIDER_CLICK',
  'EVENT_VIEW',
  'EVENT_CLICK',
  'CAMPAIGN_VIEW',
  'CAMPAIGN_CLICK',
  'STORE_VIEW',
  'STORE_CLICK',
  'CINEMA_VIEW',
  'MOVIE_VIEW',
  'MOVIE_SESSION_CLICK',
  'FORM_SUBMIT',
  'CUSTOM',
] as const;

function defaultRange(): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    dateFrom: from.toISOString().slice(0, 10) + 'T00:00:00.000Z',
    dateTo: to.toISOString().slice(0, 10) + 'T23:59:59.999Z',
  };
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{value.toLocaleString('tr-TR')}</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function AnalyticsPage() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const canView = can('analytics:view');
  const canExport = can('analytics:export');

  const [range, setRange] = useState(() => defaultRange());
  const [entityType, setEntityType] = useState<string>('');
  const [eventType, setEventType] = useState<string>('');

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [top, setTop] = useState<AnalyticsTopRow[]>([]);
  const [series, setSeries] = useState<AnalyticsTimeseriesRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryParams = useMemo(
    () => ({
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      entityType: entityType || undefined,
      eventType: eventType || undefined,
      limit: 30,
    }),
    [range.dateFrom, range.dateTo, entityType, eventType],
  );

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const mallId = activeMallId ?? undefined;
      const [s, t, ts] = await Promise.all([
        apiAnalyticsSummary(accessToken, activeTenantId, mallId, queryParams),
        apiAnalyticsTopContent(accessToken, activeTenantId, mallId, queryParams),
        apiAnalyticsTimeseries(accessToken, activeTenantId, mallId, queryParams),
      ]);
      setSummary(s);
      setTop(t);
      setSeries(ts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme hatası');
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, activeMallId, canView, queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageContainer>
        <PageHeader title="Raporlar" subtitle="Analitik verileri görüntülemek için yetkiniz yok." />
        <p style={{ color: '#6b7280', fontSize: 14 }}>Bu sayfa için `analytics:view` izni gerekir.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Raporlar"
        subtitle="Tenant / AVM bağlamına göre özet ve içerik etkileşimleri"
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
          marginBottom: 20,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Başlangıç (UTC)
          <input
            type="datetime-local"
            value={range.dateFrom.slice(0, 16)}
            onChange={(e) =>
              setRange((r) => ({
                ...r,
                dateFrom: new Date(e.target.value).toISOString(),
              }))
            }
            style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Bitiş (UTC)
          <input
            type="datetime-local"
            value={range.dateTo.slice(0, 16)}
            onChange={(e) =>
              setRange((r) => ({
                ...r,
                dateTo: new Date(e.target.value).toISOString(),
              }))
            }
            style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Varlık tipi
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 160 }}
          >
            <option value="">Tümü</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          Olay tipi
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            style={{ padding: 8, borderRadius: 6, border: '1px solid #d1d5db', minWidth: 180 }}
          >
            <option value="">Tümü</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" onClick={() => void load()} disabled={loading}>
          Yenile
        </Button>
        {canExport && (
          <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>
            Dışa aktarma (CSV) yakında
          </span>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && !summary && <LoadingState />}

      {summary && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <SummaryCard label="Toplam olay" value={summary.totalEvents} />
            <SummaryCard label="Sayfa görüntüleme" value={summary.pageViews} />
            <SummaryCard label="Slider tıklama" value={summary.sliderClicks} />
            <SummaryCard label="Etkinlik görüntüleme" value={summary.eventViews} />
            <SummaryCard label="Kampanya tıklama" value={summary.campaignClicks} />
            <SummaryCard label="Mağaza görüntüleme" value={summary.storeViews} />
            <SummaryCard label="Sinema görüntüleme" value={summary.cinemaViews} />
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Öne çıkan içerik</h2>
          <div style={{ overflowX: 'auto', marginBottom: 28 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 6px' }}>Varlık</th>
                  <th style={{ padding: '8px 6px' }}>ID</th>
                  <th style={{ padding: '8px 6px' }}>Olay</th>
                  <th style={{ padding: '8px 6px' }}>Adet</th>
                </tr>
              </thead>
              <tbody>
                {top.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: '#9ca3af' }}>
                      Veri yok
                    </td>
                  </tr>
                ) : (
                  top.map((row, i) => (
                    <tr key={`${row.entityType}-${row.entityId}-${row.eventType}-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 6px' }}>{row.entityType}</td>
                      <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 11 }}>
                        {row.entityId ?? '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>{row.eventType}</td>
                      <td style={{ padding: '8px 6px' }}>{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Günlük dağılım</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px 6px' }}>Tarih (UTC)</th>
                  <th style={{ padding: '8px 6px' }}>Olay tipleri (adet)</th>
                </tr>
              </thead>
              <tbody>
                {series.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ padding: 16, color: '#9ca3af' }}>
                      Veri yok
                    </td>
                  </tr>
                ) : (
                  series.map((row) => (
                    <tr key={row.date} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{row.date}</td>
                      <td style={{ padding: '8px 6px', color: '#374151' }}>
                        {Object.entries(row.byEventType)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ') || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
