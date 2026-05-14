import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import { apiRolesList, apiRoleCreate, apiRoleClone, apiRoleDelete, type CmsRole } from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

export function RolesPage() {
  const { accessToken, user, tenants, activeTenantId } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<CmsRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTenantId, setFilterTenantId] = useState(user?.isSuperAdmin ? '' : (activeTenantId ?? ''));
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    apiRolesList(accessToken, filterTenantId || undefined)
      .then((d) => setRoles(d.roles))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, filterTenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!accessToken) return;
    setCreating(true);
    try {
      const r = await apiRoleCreate(accessToken, { name: createName, description: createDesc || undefined });
      toast.success('Rol oluşturuldu');
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      navigate(`/roles/${r.id}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setCreating(false); }
  };

  const handleClone = async (role: CmsRole) => {
    if (!accessToken) return;
    const name = prompt(`"${role.name}" rolünü klonlayın — yeni ad:`);
    if (!name?.trim()) return;
    try {
      const cloned = await apiRoleClone(accessToken, role.id, name.trim());
      toast.success('Rol klonlandı');
      navigate(`/roles/${cloned.id}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async (role: CmsRole) => {
    if (!accessToken) return;
    if (!confirm(`"${role.name}" rolünü silmek istediğinizden emin misiniz?`)) return;
    try {
      await apiRoleDelete(accessToken, role.id);
      toast.success('Rol silindi');
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <PageContainer>
      <PageHeader title="Roller" subtitle="Rol ve izin yönetimi" />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {user?.isSuperAdmin && (
          <select
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
          >
            <option value="">Tüm Roller</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} Özel Rolleri</option>)}
          </select>
        )}
        {can('role:create') && (
          <button
            onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto', padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Rol Oluştur
          </button>
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 380, maxWidth: '90vw' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Rol Oluştur</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Ad *</label>
              <input value={createName} onChange={(e) => setCreateName(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Açıklama</label>
              <input value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '7px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>İptal</button>
              <button onClick={handleCreate} disabled={creating || !createName.trim()} style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {creating ? 'Oluşturuluyor…' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Rol Adı', 'Tür', 'İzin Sayısı', 'Kullanıcı', 'Durum', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.code}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: r.isSystem ? '#eff6ff' : '#f5f3ff',
                      color: r.isSystem ? '#2563eb' : '#7c3aed',
                    }}>
                      {r.isSystem ? 'Sistem' : 'Özel'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.permissions.length}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{r.usageCount}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: r.isActive ? '#16a34a' : '#9ca3af' }}>
                      {r.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => navigate(`/roles/${r.id}`)} style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fff' }}>Detay</button>
                      {can('role:create') && (
                        <button onClick={() => handleClone(r)} style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fff' }}>Klonla</button>
                      )}
                      {can('role:delete') && !r.isSystem && (
                        <button onClick={() => handleDelete(r)} style={{ padding: '4px 10px', border: '1px solid #fecaca', borderRadius: 5, fontSize: 12, cursor: 'pointer', background: '#fef2f2', color: '#dc2626' }}>Sil</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
