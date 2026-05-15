import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { apiAuditLogGet, type AuditLog, type AuditSeverity } from '../lib/api';

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

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ minWidth: 160, fontWeight: 500, color: '#6b7280', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  const [collapsed, setCollapsed] = useState(true);
  if (data === null || data === undefined) return null;
  const json = JSON.stringify(data, null, 2);
  const lines = json.split('\n').length;
  const isLarge = lines > 20;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{label}</div>
        {isLarge && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              fontSize: 12,
              color: '#2563eb',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
            }}
          >
            {collapsed ? 'Genişlet ▼' : 'Daralt ▲'}
          </button>
        )}
      </div>
      <pre
        style={{
          background: '#1e293b',
          color: '#e2e8f0',
          borderRadius: 6,
          padding: '12px 16px',
          fontSize: 12,
          fontFamily: 'monospace',
          overflowX: 'auto',
          maxHeight: isLarge && collapsed ? 200 : undefined,
          overflow: isLarge && collapsed ? 'hidden' : 'auto',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {json}
      </pre>
    </div>
  );
}

function DiffView({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changedKeys = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (changedKeys.length === 0) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Değişiklik yok.</div>;

  return (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {changedKeys.map((k) => (
        <div key={k}>
          <div style={{ padding: '6px 12px', background: '#fef2f2', color: '#991b1b', borderBottom: '1px solid #fde8e8' }}>
            - {k}: {JSON.stringify(before[k])}
          </div>
          <div style={{ padding: '6px 12px', background: '#f0fdf4', color: '#166534', borderBottom: '1px solid #dcfce7' }}>
            + {k}: {JSON.stringify(after[k])}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditLogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { can } = usePermission();
  const canRead = can('audit:read');

  const [log, setLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken || !id || !canRead) { setLoading(false); return; }
    apiAuditLogGet(accessToken, id)
      .then(setLog)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, id, canRead]);

  if (!canRead) {
    return (
      <PageContainer>
        <PageHeader title="Denetim Günlüğü" />
        <div style={{ color: '#dc2626', padding: 24 }}>Bu sayfaya erişim yetkiniz yok.</div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Denetim Günlüğü" />
        <div style={{ padding: 32, color: '#9ca3af' }}>Yükleniyor…</div>
      </PageContainer>
    );
  }

  if (error || !log) {
    return (
      <PageContainer>
        <PageHeader title="Denetim Günlüğü" />
        <div style={{ color: '#dc2626', padding: 24 }}>{error || 'Kayıt bulunamadı.'}</div>
      </PageContainer>
    );
  }

  const sev = SEVERITY_COLORS[log.severity] ?? SEVERITY_COLORS.INFO;
  const meta = log.metadata as Record<string, unknown> | null;
  const before = meta?.before as Record<string, unknown> | undefined;
  const after = meta?.after as Record<string, unknown> | undefined;
  const ip = meta?.ip as string | undefined;
  const userAgent = meta?.userAgent as string | undefined;
  const actorName = log.actor
    ? `${[log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ')} <${log.actor.email}>`
    : (log.actorUserId ?? 'Sistem');

  return (
    <PageContainer>
      <PageHeader
        title="Denetim Günlüğü Detayı"
        subtitle={log.id}
        action={
          <Link
            to="/audit-logs"
            style={{
              color: '#2563eb',
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            ← Listeye dön
          </Link>
        }
      />

      {/* Severity header */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: sev.bg,
          color: sev.text,
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 24,
        }}
      >
        <span>{SEVERITY_LABELS[log.severity]}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>{log.action}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span style={{ fontWeight: 400 }}>{log.success ? 'Başarılı' : 'Başarısız'}</span>
      </div>

      {/* Core metadata */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Temel Bilgiler</h3>
        <MetaRow label="Zaman" value={new Date(log.createdAt).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'medium' })} />
        <MetaRow label="Aktör" value={actorName} />
        <MetaRow
          label="Tenant"
          value={log.tenant ? `${log.tenant.name} (${log.tenant.slug})` : (log.tenantId ?? '—')}
        />
        <MetaRow
          label="Lokasyon"
          value={log.mall ? `${log.mall.name} (${log.mall.slug})` : (log.mallId ?? '—')}
        />
        <MetaRow label="İşlem" value={<code style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>{log.action}</code>} />
        <MetaRow label="Kaynak Tipi" value={log.resource} />
        {log.resourceId && <MetaRow label="Kaynak ID" value={<code style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.resourceId}</code>} />}
        {log.resourceName && <MetaRow label="Kaynak Adı" value={log.resourceName} />}
        <MetaRow label="Kaynak" value={log.source ?? '—'} />
      </div>

      {/* Traceability */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>İzlenebilirlik</h3>
        {log.correlationId && <MetaRow label="Correlation ID" value={<code style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.correlationId}</code>} />}
        {log.requestId && <MetaRow label="Request ID" value={<code style={{ fontFamily: 'monospace', fontSize: 12 }}>{log.requestId}</code>} />}
        {ip && <MetaRow label="IP Adresi" value={ip} />}
        {userAgent && <MetaRow label="User Agent" value={<span style={{ fontSize: 12, color: '#6b7280' }}>{userAgent}</span>} />}
        {!log.correlationId && !log.requestId && !ip && !userAgent && (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>İzlenebilirlik verisi yok.</div>
        )}
      </div>

      {/* Diff view */}
      {before && after && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Değişiklik Farkı</h3>
          <DiffView before={before} after={after} />
        </div>
      )}

      {/* Before / After JSON */}
      {before && <JsonBlock data={before} label="Önceki Durum (Before)" />}
      {after && <JsonBlock data={after} label="Sonraki Durum (After)" />}

      {/* Full metadata */}
      {meta && (
        <JsonBlock
          data={(() => {
            const { before: _b, after: _a, ip: _ip, userAgent: _ua, ...rest } = meta;
            return Object.keys(rest).length > 0 ? rest : undefined;
          })()}
          label="Ek Metadata"
        />
      )}
    </PageContainer>
  );
}
