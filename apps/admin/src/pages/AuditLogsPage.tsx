import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import {
  apiAuditLogsList,
  apiAuditLogsExportUrl,
  type AuditLog,
  type AuditLogFilters,
  type AuditSeverity,
} from '../lib/api';

const SEVERITY_COLORS: Record<AuditSeverity, { bg: string; text: string }> = {
  INFO: { bg: '#eff6ff', text: '#1d4ed8' },
  WARNING: { bg: '#fffbeb', text: '#b45309' },
  ERROR: { bg: '#fef2f2', text: '#dc2626' },
  SECURITY: { bg: '#fdf4ff', text: '#7c3aed' },
  CRITICAL: { bg: '#fff1f2', text: '#be123c' },
};

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  INFO: 'Bilgi',
  WARNING: 'Uyarı',
  ERROR: 'Hata',
  SECURITY: 'Güvenlik',
  CRITICAL: 'Kritik',
};

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const { bg, text } = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.INFO;
  return (
    <span
      style={{
        display: 'inline-block',
        background: bg,
        color: text,
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 4,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
      }}
    >
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  );
}

function SuccessBadge({ success }: { success: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: success ? '#f0fdf4' : '#fef2f2',
        color: success ? '#16a34a' : '#dc2626',
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 4,
      }}
    >
      {success ? '✓' : '✗'}
    </span>
  );
}

function actorLabel(log: AuditLog): string {
  if (!log.actor) return log.actorUserId ? log.actorUserId.slice(0, 8) + '…' : 'Sistem';
  const name = [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ');
  return name || log.actor.email;
}

export function AuditLogsPage() {
  const { accessToken, activeTenantId, user } = useAuth();
  const { can } = usePermission();
  const canRead = can('audit:read');
  const canExport = can('audit:export');

  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  });

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(() => {
    if (!accessToken || !canRead) return;
    setLoading(true);
    const f: AuditLogFilters = {
      ...filters,
      tenantId: user?.isSuperAdmin ? filters.tenantId : (activeTenantId ?? undefined),
      search: search || undefined,
      severity: severityFilter ? (severityFilter as AuditSeverity) : undefined,
      success: successFilter === '' ? undefined : successFilter === 'true',
      resource: resourceFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    apiAuditLogsList(accessToken, f)
      .then((r) => { setItems(r.items); setTotal(r.total); setPages(r.pages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, canRead, filters, search, severityFilter, successFilter, resourceFilter, dateFrom, dateTo, activeTenantId, user]);

  useEffect(() => { load(); }, [load]);

  if (!canRead) {
    return (
      <PageContainer>
        <PageHeader title="Denetim Günlükleri" />
        <div style={{ color: '#dc2626', padding: 24 }}>Bu sayfaya erişim yetkiniz yok.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Denetim Günlükleri"
        subtitle={`${total.toLocaleString('tr-TR')} kayıt`}
        action={
          canExport ? (
            <a
              href={apiAuditLogsExportUrl(
                {
                  tenantId: user?.isSuperAdmin ? filters.tenantId : (activeTenantId ?? undefined),
                  severity: severityFilter ? (severityFilter as AuditSeverity) : undefined,
                  dateFrom: dateFrom || undefined,
                  dateTo: dateTo || undefined,
                },
                'csv',
              )}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                color: '#374151',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              CSV İndir
            </a>
          ) : undefined
        }
      />

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
          padding: '14px 16px',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        <input
          placeholder="Ara…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 180 }}
        />
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        >
          <option value="">Tüm Önem Derecesi</option>
          {(Object.keys(SEVERITY_LABELS) as AuditSeverity[]).map((s) => (
            <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={successFilter}
          onChange={(e) => { setSuccessFilter(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        >
          <option value="">Tümü</option>
          <option value="true">Başarılı</option>
          <option value="false">Başarısız</option>
        </select>
        <input
          placeholder="Kaynak tipi (örn: user)"
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 180 }}
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
        />
        <button
          onClick={() => {
            setSearch('');
            setSeverityFilter('');
            setSuccessFilter('');
            setResourceFilter('');
            setDateFrom('');
            setDateTo('');
            setFilters({ page: 1, limit: 50 });
          }}
          style={{
            padding: '6px 12px',
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
            color: '#6b7280',
          }}
        >
          Temizle
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
              {['Zaman', 'Aktör', 'Tenant', 'İşlem', 'Kaynak', 'Önem', 'Sonuç'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#374151',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Yükleniyor…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Kayıt bulunamadı.</td>
              </tr>
            ) : (
              items.map((log) => (
                <tr
                  key={log.id}
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>
                    <Link to={`/audit-logs/${log.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                      {new Date(log.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' })}
                    </Link>
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{actorLabel(log)}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {log.tenant?.name ?? log.tenantId?.slice(0, 8) ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{log.action}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {log.resource}
                    {log.resourceName && <span style={{ color: '#374151' }}> · {log.resourceName}</span>}
                    {log.resourceId && !log.resourceName && (
                      <span style={{ color: '#9ca3af', fontSize: 11 }}> ({log.resourceId.slice(0, 8)}…)</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <SeverityBadge severity={log.severity} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <SuccessBadge success={log.success} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, justifyContent: 'center' }}>
          <button
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            style={{
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              cursor: (filters.page ?? 1) <= 1 ? 'default' : 'pointer',
              opacity: (filters.page ?? 1) <= 1 ? 0.4 : 1,
            }}
          >
            ← Önceki
          </button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            Sayfa {filters.page ?? 1} / {pages}
          </span>
          <button
            disabled={(filters.page ?? 1) >= pages}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            style={{
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              cursor: (filters.page ?? 1) >= pages ? 'default' : 'pointer',
              opacity: (filters.page ?? 1) >= pages ? 0.4 : 1,
            }}
          >
            Sonraki →
          </button>
        </div>
      )}
    </PageContainer>
  );
}
