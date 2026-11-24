import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import {
  apiAnalyticsSummary,
  apiAnalyticsTimeseries,
  apiAnalyticsTopContent,
  apiAnalyticsTopPaths,
  type AnalyticsSummary,
  type AnalyticsTopRow,
  type AnalyticsTimeseriesRow,
} from '../lib/api/analytics';

const CATEGORIES = [
  ['', 'Tüm içerikler'],
  ['STORE', 'Mağazalar'],
  ['EVENT', 'Etkinlikler'],
  ['CAMPAIGN', 'Kampanyalar'],
  ['CINEMA', 'Sinemalar'],
  ['MOVIE', 'Filmler'],
  ['MOVIE_SESSION', 'Seanslar'],
  ['SLIDER', 'Slaytlar'],
  ['CUSTOM', 'Diğer bağlantılar'],
  ['PAGE', 'Sayfalar'],
];
const isClick = (type: string) => type.endsWith('_CLICK');
const eventLabel = (type: string) =>
  isClick(type) ? 'Tıklama' : type.endsWith('_VIEW') ? 'Görüntüleme' : type;
const categoryLabel = (type: string) => CATEGORIES.find(([id]) => id === type)?.[1] ?? type;
const count = (n: number) => n.toLocaleString('tr-TR');
const dateValue = (d: Date) => d.toISOString().slice(0, 10);
const inputStyle = {
  padding: '9px 12px',
  border: '1px solid #dce2eb',
  borderRadius: 8,
  font: 'inherit',
  fontSize: 13,
  background: '#fff',
  minHeight: 40,
};
const panelStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 20,
  minWidth: 0,
};
type Report = {
  scope: string;
  summary: AnalyticsSummary;
  top: AnalyticsTopRow[];
  series: AnalyticsTimeseriesRow[];
  paths: Array<{ path: string; eventType: string; count: number }>;
};

export function AnalyticsPage() {
  const { accessToken, activeTenantId, activeMallId, malls } = useAuth();
  const { can } = usePermission();
  const canView = can('analytics:view');
  const [dateFrom, setDateFrom] = useState(() => dateValue(new Date(Date.now() - 29 * 86400000)));
  const [dateTo, setDateTo] = useState(() => dateValue(new Date()));
  const [entityType, setEntityType] = useState('');
  const [metric, setMetric] = useState<'clicks' | 'views' | 'all'>('clicks');
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = `${activeTenantId}:${activeMallId}`;
  const invalidRange =
    !dateFrom ||
    !dateTo ||
    dateFrom > dateTo ||
    new Date(dateTo).getTime() - new Date(dateFrom).getTime() > 365 * 86400000;
  const query = useMemo(
    () => ({
      dateFrom: `${dateFrom}T00:00:00.000Z`,
      dateTo: `${dateTo}T23:59:59.999Z`,
      entityType: entityType || undefined,
      metric,
      limit: 30,
    }),
    [dateFrom, dateTo, entityType, metric],
  );

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    setLoading(false);
    if (!accessToken || !activeTenantId || !activeMallId || !canView || invalidRange) return;
    setLoading(true);
    void Promise.all([
      apiAnalyticsSummary(accessToken, activeTenantId, activeMallId, {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      }),
      apiAnalyticsTopContent(accessToken, activeTenantId, activeMallId, query),
      apiAnalyticsTimeseries(accessToken, activeTenantId, activeMallId, query),
      apiAnalyticsTopPaths(accessToken, activeTenantId, activeMallId, query),
    ])
      .then(([summary, top, series, paths]) => {
        if (!cancelled) setReport({ scope, summary, top, series, paths });
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'Raporlar yüklenemedi. Bağlantınızı ve raporlama özelliğinin etkin olduğunu kontrol edip tekrar deneyin.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTenantId, activeMallId, canView, invalidRange, query, revision, scope]);

  const data = report?.scope === scope ? report : null;
  const summaryCards: Array<[string, number]> = data
    ? [
        ['Toplam tıklama', data.summary.totalClicks],
        ['Sayfa görüntüleme', data.summary.pageViews],
        ['Mağaza tıklamaları', data.summary.storeClicks],
        ['Etkinlik tıklamaları', data.summary.eventClicks],
        ['Kampanya tıklamaları', data.summary.campaignClicks],
        ['Sinema tıklamaları', data.summary.cinemaClicks],
        ['Film tıklamaları', data.summary.movieClicks],
      ]
    : [];
  const totals =
    data?.series.map((day) => ({
      date: day.date,
      count: Object.values(day.byEventType).reduce((sum, n) => sum + n, 0),
    })) ?? [];
  const max = Math.max(1, ...totals.map((day) => day.count));
  const metricLabel =
    metric === 'clicks' ? 'tıklanan' : metric === 'views' ? 'görüntülenen' : 'etkileşim alan';

  return (
    <PageContainer>
      <PageHeader
        title="Web sitesi raporları"
        subtitle={`${malls.find((m) => m.id === activeMallId)?.name ?? 'Seçili AVM'} · Ziyaretçilerinizin ilgi gösterdiği içerikleri keşfedin.`}
      />
      {!canView ? (
        <EmptyState title="Rapor görüntüleme yetkiniz yok" />
      ) : !activeMallId ? (
        <EmptyState title="Raporlar için bir AVM seçin" />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'end',
              marginBottom: 20,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
              Başlangıç
              <input
                aria-label="Rapor başlangıç tarihi"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
              Bitiş
              <input
                aria-label="Rapor bitiş tarihi"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={inputStyle}
              />
            </label>
            <Button
              onClick={() => {
                setDateFrom(dateValue(new Date(Date.now() - 6 * 86400000)));
                setDateTo(dateValue(new Date()));
              }}
            >
              Son 7 gün
            </Button>
            <Button disabled={loading || invalidRange} onClick={() => setRevision((n) => n + 1)}>
              Yenile
            </Button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Gün sınırları UTC. Sayılar tekil kişi sayısı değildir.
            </span>
          </div>
          {invalidRange && (
            <ErrorBanner message="En fazla 366 gün içeren geçerli bir tarih aralığı seçin." />
          )}
          {error && <ErrorBanner message={error} />}
          {loading && <LoadingState label="Web sitesi raporları yükleniyor…" />}
          {data && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {summaryCards.map(([label, value]) => (
                  <div key={label} style={{ ...panelStyle, padding: 16 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{label}</div>
                    <strong style={{ fontSize: 26, fontVariantNumeric: 'tabular-nums' }}>
                      {count(value)}
                    </strong>
                  </div>
                ))}
              </div>
              {data.summary.totalEvents === 0 && (
                <EmptyState
                  title="Bu aralıkta henüz ölçüm yok"
                  description="Web sitesi ölçüm bağlantısı etkinleştirildikten sonra tıklama ve görüntülemeler burada listelenir. Geçmiş ziyaretler geriye dönük oluşturulmaz."
                />
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                  İçerik
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    style={inputStyle}
                  >
                    {CATEGORIES.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                  Ölçüm
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as typeof metric)}
                    style={inputStyle}
                  >
                    <option value="clicks">Tıklamalar</option>
                    <option value="views">Görüntülemeler</option>
                    <option value="all">Tüm etkileşimler</option>
                  </select>
                </label>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))',
                  gap: 20,
                  marginBottom: 24,
                }}
              >
                <section style={panelStyle}>
                  <h2 style={{ fontSize: 16, margin: '0 0 18px' }}>
                    En çok {metricLabel} içerikler
                  </h2>
                  {!data.top.length ? (
                    <p style={{ fontSize: 13, color: '#6b7280' }}>
                      Seçilen filtrelerde içerik etkileşimi bulunamadı.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                      {data.top.map((row, i) => (
                        <div key={`${row.entityType}:${row.entityId}:${row.eventType}`}>
                          <div
                            style={{
                              display: 'flex',
                              gap: 12,
                              alignItems: 'start',
                              justifyContent: 'space-between',
                              fontSize: 13,
                            }}
                          >
                            <span>
                              <span style={{ color: '#9ca3af', marginRight: 10 }}>{i + 1}.</span>
                              <strong>{row.name}</strong>
                              <small
                                style={{
                                  display: 'block',
                                  color: '#6b7280',
                                  margin: '5px 0 0 22px',
                                }}
                              >
                                {categoryLabel(row.entityType)} · {eventLabel(row.eventType)}
                              </small>
                            </span>
                            <strong
                              style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                            >
                              {count(row.count)}
                            </strong>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: '#f1f5f9',
                              borderRadius: 4,
                              marginTop: 8,
                            }}
                          >
                            <div
                              style={{
                                width: `${(row.count / Math.max(1, data.top[0]!.count)) * 100}%`,
                                height: '100%',
                                background: '#2563eb',
                                borderRadius: 4,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section style={panelStyle}>
                  <h2 style={{ fontSize: 16, margin: '0 0 18px' }}>
                    En çok {metricLabel} sayfa yolları
                  </h2>
                  {!data.paths.length ? (
                    <p style={{ fontSize: 13, color: '#6b7280' }}>Henüz yol bazlı ölçüm yok.</p>
                  ) : (
                    data.paths.map((row, i) => (
                      <div
                        key={`${row.path}:${row.eventType}`}
                        style={{
                          display: 'flex',
                          gap: 12,
                          justifyContent: 'space-between',
                          padding: '12px 0',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: 13,
                        }}
                      >
                        <span style={{ overflowWrap: 'anywhere' }}>
                          {i + 1}. {row.path}
                          <small style={{ display: 'block', color: '#6b7280', marginTop: 4 }}>
                            {eventLabel(row.eventType)}
                          </small>
                        </span>
                        <strong>{count(row.count)}</strong>
                      </div>
                    ))
                  )}
                </section>
              </div>
              <section style={panelStyle}>
                <h2 style={{ fontSize: 16, margin: '0 0 18px' }}>Günlük etkileşim dağılımı</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="cms-data-table" style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Tarih (UTC)</th>
                        <th style={{ textAlign: 'left' }}>Dağılım</th>
                        <th style={{ textAlign: 'right' }}>Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.map((day) => (
                        <tr key={day.date}>
                          <td style={{ padding: '9px 0', whiteSpace: 'nowrap' }}>{day.date}</td>
                          <td style={{ width: '65%', padding: '9px 16px' }}>
                            <div
                              aria-hidden="true"
                              style={{
                                height: 8,
                                width: `${(day.count / max) * 100}%`,
                                background: '#93b4f3',
                                borderRadius: 5,
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>{count(day.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}
