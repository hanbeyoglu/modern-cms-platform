import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { apiAuditLogsTimeline, type AuditLog, type AuditSeverity } from '../lib/api';

const SEVERITY_COLORS: Record<AuditSeverity, string> = {
  INFO: '#3b82f6',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  SECURITY: '#8b5cf6',
  CRITICAL: '#e11d48',
};

function actorLabel(log: AuditLog): string {
  if (!log.actor) return log.actorUserId ? 'Sistem/API' : 'Sistem';
  const name = [log.actor.firstName, log.actor.lastName].filter(Boolean).join(' ');
  return name || log.actor.email;
}

function actionLabel(action: string): string {
  const MAP: Record<string, string> = {
    'create': 'Oluşturuldu',
    'update': 'Güncellendi',
    'delete': 'Silindi',
    'publish': 'Yayınlandı',
    'unpublish': 'Yayından kaldırıldı',
    'archive': 'Arşivlendi',
    'activate': 'Etkinleştirildi',
    'deactivate': 'Devre dışı bırakıldı',
    'login': 'Giriş yapıldı',
    'logout': 'Çıkış yapıldı',
    'password-reset': 'Şifre sıfırlandı',
    'permission-change': 'İzin değiştirildi',
    'status-change': 'Durum değiştirildi',
    'translate': 'Çevrildi',
  };
  for (const [key, label] of Object.entries(MAP)) {
    if (action.includes(key)) return label;
  }
  return action;
}

type Props = {
  entityType: string;
  entityId: string;
};

export function AuditTimeline({ entityType, entityId }: Props) {
  const { accessToken } = useAuth();
  const { can } = usePermission();
  const canRead = can('audit:read');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !canRead || !entityId) return;
    setLoading(true);
    apiAuditLogsTimeline(accessToken, entityType, entityId)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, canRead, entityType, entityId]);

  if (!canRead) return null;

  return (
    <div>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
        Değişiklik Geçmişi
      </h3>

      {loading ? (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>Yükleniyor…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 13 }}>Henüz kayıt yok.</div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* vertical line */}
          <div
            style={{
              position: 'absolute',
              left: 8,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#e5e7eb',
            }}
          />

          {logs.map((log) => {
            const dotColor = SEVERITY_COLORS[log.severity] ?? '#9ca3af';
            const isExpanded = expanded === log.id;

            return (
              <div key={log.id} style={{ position: 'relative', marginBottom: 16 }}>
                {/* dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: -20,
                    top: 3,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: dotColor,
                    border: '2px solid #fff',
                    boxShadow: '0 0 0 1px #e5e7eb',
                  }}
                />

                <div
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '10px 14px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
                      {actionLabel(log.action)}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{actorLabel(log)}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>·</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                      {new Date(log.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {!log.success && (
                      <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                        Başarısız
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace', marginBottom: 6 }}>
                        İşlem: {log.action}
                      </div>
                      {log.source && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                          Kaynak: {log.source}
                        </div>
                      )}
                      {log.correlationId && (
                        <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace', marginBottom: 6 }}>
                          ID: {log.correlationId}
                        </div>
                      )}
                      <Link
                        to={`/audit-logs/${log.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: 12, color: '#2563eb' }}
                      >
                        Detay görüntüle →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
