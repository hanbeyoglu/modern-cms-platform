import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { usePermission } from '../hooks/usePermission';
import {
  apiRoleGet,
  apiRoleUpdate,
  apiRoleUpdatePermissions,
  apiPermissionsList,
  type CmsRole,
  type PermissionGroup,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

const GROUP_LABELS: Record<string, string> = {
  media: 'Medya',
  sliders: 'Sliderlar',
  events: 'Etkinlikler',
  campaigns: 'Kampanyalar',
  stores: 'Mağazalar',
  pages: 'Sayfalar',
  analytics: 'Analitik',
  notifications: 'Bildirimler',
  localization: 'Lokalizasyon',
  search: 'Arama',
  users: 'Kullanıcılar',
  roles: 'Roller',
  settings: 'Ayarlar',
  capabilities: 'Yetenekler',
  tenants: 'Tenant & Mall',
  other: 'Diğer',
};

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [role, setRole] = useState<CmsRole | null>(null);
  const [groups, setGroups] = useState<PermissionGroup>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [searchPerm, setSearchPerm] = useState('');

  const reload = () => {
    if (!accessToken || !id) return;
    setLoading(true);
    Promise.all([apiRoleGet(accessToken, id), apiPermissionsList(accessToken)])
      .then(([r, p]) => {
        setRole(r);
        setGroups(p.groups);
        setSelectedIds(new Set(r.permissions.map((p) => p.id)));
        setEditName(r.name);
        setEditDesc(r.description ?? '');
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [accessToken, id]);

  const handleSaveInfo = async () => {
    if (!accessToken || !role) return;
    setSaving(true);
    try {
      await apiRoleUpdate(accessToken, role.id, { name: editName, description: editDesc });
      toast.success('Rol güncellendi');
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleSavePermissions = async () => {
    if (!accessToken || !role) return;
    setSaving(true);
    try {
      await apiRoleUpdatePermissions(accessToken, role.id, Array.from(selectedIds));
      toast.success('İzinler güncellendi');
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const togglePerm = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (perms: Array<{ id: string }>) => {
    const allSelected = perms.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) perms.forEach((p) => next.delete(p.id));
      else perms.forEach((p) => next.add(p.id));
      return next;
    });
  };

  if (loading) return <PageContainer><div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div></PageContainer>;
  if (!role) return <PageContainer><div style={{ color: '#dc2626' }}>Rol bulunamadı</div></PageContainer>;

  const permsDirty = !([...selectedIds].every((id) => role.permissions.some((p) => p.id === id)) &&
    role.permissions.every((p) => selectedIds.has(p.id)));

  return (
    <PageContainer>
      <PageHeader
        title={role.name}
        subtitle={role.isSystem ? 'Sistem Rolü' : 'Özel Rol'}
        action={
          <button onClick={() => navigate('/roles')} style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
            ← Geri
          </button>
        }
      />

      {/* Info section */}
      {!role.isSystem && can('role:update') && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 14 }}>Rol Bilgileri</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Ad</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: '#374151' }}>Açıklama</label>
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button
              onClick={handleSaveInfo}
              disabled={saving}
              style={{ padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* Permission matrix */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>İzin Matrisi</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder="İzin ara…"
              value={searchPerm}
              onChange={(e) => setSearchPerm(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, width: 160 }}
            />
            {!role.isSystem && can('role:update') && permsDirty && (
              <button
                onClick={handleSavePermissions}
                disabled={saving}
                style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {saving ? 'Kaydediliyor…' : 'İzinleri Kaydet'}
              </button>
            )}
          </div>
        </div>

        {Object.entries(groups).map(([groupKey, perms]) => {
          const filtered = searchPerm
            ? perms.filter((p) => p.code.toLowerCase().includes(searchPerm.toLowerCase()))
            : perms;
          if (!filtered.length) return null;
          const allSel = filtered.every((p) => selectedIds.has(p.id));
          return (
            <div key={groupKey} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {!role.isSystem && can('role:update') && (
                  <input
                    type="checkbox"
                    checked={allSel}
                    onChange={() => toggleGroup(filtered)}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                  {GROUP_LABELS[groupKey] ?? groupKey}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {filtered.map((p) => {
                  const checked = selectedIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        border: `1px solid ${checked ? '#bfdbfe' : '#e5e7eb'}`,
                        borderRadius: 20,
                        fontSize: 12,
                        background: checked ? '#eff6ff' : '#f9fafb',
                        color: checked ? '#1d4ed8' : '#374151',
                        cursor: role.isSystem || !can('role:update') ? 'default' : 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {!role.isSystem && can('role:update') && (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerm(p.id)}
                          style={{ display: 'none' }}
                        />
                      )}
                      <span onClick={() => !role.isSystem && can('role:update') && togglePerm(p.id)}>
                        {p.code}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
