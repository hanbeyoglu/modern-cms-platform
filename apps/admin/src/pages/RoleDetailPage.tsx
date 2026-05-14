import { useCallback, useEffect, useState } from 'react';
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
  type RolePermission,
} from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';

// ── Permission metadata ────────────────────────────────────────────────────────

const PERMISSION_LABELS: Record<string, string> = {
  'tenant:read': 'Müşteri görüntüle',
  'tenant:create': 'Müşteri oluştur',
  'tenant:update': 'Müşteri düzenle',
  'tenant:delete': 'Müşteri sil',
  'mall:read': 'Lokasyon görüntüle (legacy)',
  'mall:switch': 'Lokasyon değiştir',
  'location:read': 'Lokasyon görüntüle',
  'location:create': 'Lokasyon oluştur',
  'location:update': 'Lokasyon düzenle',
  'location:delete': 'Lokasyon sil',
  'user:read': 'Kullanıcı görüntüle',
  'user:create': 'Kullanıcı oluştur',
  'user:update': 'Kullanıcı düzenle',
  'user:delete': 'Kullanıcı sil/pasifleştir',
  'role:read': 'Rol görüntüle',
  'role:create': 'Rol oluştur',
  'role:update': 'Rol düzenle',
  'role:delete': 'Rol sil',
  'settings:read': 'Ayarları görüntüle',
  'settings:update': 'Ayarları güncelle',
  'capability:read': 'Yetenekleri görüntüle',
  'capability:update': 'Yetenekleri güncelle',
  'analytics:view': 'Raporları görüntüle',
  'analytics:export': 'Raporları dışa aktar',
  'content:read': 'İçerik görüntüle',
  'content:create': 'İçerik oluştur',
  'content:update': 'İçerik düzenle',
  'content:publish': 'İçerik yayınla',
  'media:read': 'Medya görüntüle',
  'media:upload': 'Medya yükle',
  'media:delete': 'Medya sil',
  'slider:read': 'Slider görüntüle',
  'slider:create': 'Slider oluştur',
  'slider:update': 'Slider düzenle',
  'slider:delete': 'Slider sil',
  'slider:publish': 'Slider yayınla',
  'slider:reorder': 'Slider sırasını değiştir',
  'store-category:read': 'Mağaza kategorisi görüntüle',
  'store-category:create': 'Mağaza kategorisi oluştur',
  'store-category:update': 'Mağaza kategorisi düzenle',
  'store-category:delete': 'Mağaza kategorisi sil',
  'global-store:read': 'Global mağaza görüntüle',
  'global-store:create': 'Global mağaza oluştur',
  'global-store:update': 'Global mağaza düzenle',
  'global-store:delete': 'Global mağaza sil',
  'mall-store:read': 'Lokasyon mağazası görüntüle',
  'mall-store:assign': 'Lokasyona mağaza ekle',
  'mall-store:update': 'Lokasyon mağazası düzenle',
  'mall-store:delete': 'Lokasyon mağazası sil',
  'mall-store:feature': 'Mağazayı öne çıkar',
  'event:read': 'Etkinlik görüntüle',
  'event:create': 'Etkinlik oluştur',
  'event:update': 'Etkinlik düzenle',
  'event:delete': 'Etkinlik sil',
  'event:publish': 'Etkinlik yayınla',
  'event:archive': 'Etkinliği arşivle',
  'campaign:read': 'Kampanya görüntüle',
  'campaign:create': 'Kampanya oluştur',
  'campaign:update': 'Kampanya düzenle',
  'campaign:delete': 'Kampanya sil',
  'campaign:publish': 'Kampanya yayınla',
  'campaign:archive': 'Kampanyayı arşivle',
  'cinema:read': 'Sinema görüntüle',
  'cinema:create': 'Sinema oluştur',
  'cinema:update': 'Sinema düzenle',
  'cinema:delete': 'Sinema sil',
  'movie:read': 'Film görüntüle',
  'movie:create': 'Film oluştur',
  'movie:update': 'Film düzenle',
  'movie:delete': 'Film sil',
  'movie-session:read': 'Seans görüntüle',
  'movie-session:create': 'Seans oluştur',
  'movie-session:update': 'Seans düzenle',
  'movie-session:delete': 'Seans sil',
  'movie-session:cancel': 'Seans iptal et',
  'page:read': 'Sayfa görüntüle',
  'page:create': 'Sayfa oluştur',
  'page:update': 'Sayfa düzenle',
  'page:delete': 'Sayfa sil',
  'page:publish': 'Sayfa yayınla',
  'page:archive': 'Sayfayı arşivle',
  'page-block:read': 'Sayfa bloğu görüntüle',
  'page-block:create': 'Sayfa bloğu oluştur',
  'page-block:update': 'Sayfa bloğu düzenle',
  'page-block:delete': 'Sayfa bloğu sil',
  'page-block:reorder': 'Blok sırası değiştir',
  'locale:read': 'Dil görüntüle',
  'locale:create': 'Dil oluştur',
  'locale:update': 'Dil düzenle',
  'locale:delete': 'Dil sil',
  'locale:set-default': 'Varsayılan dili belirle',
  'translation:read': 'Çeviri görüntüle',
  'translation:create': 'Çeviri oluştur',
  'translation:update': 'Çeviri düzenle',
  'translation:delete': 'Çeviri sil',
  'notification:read': 'Bildirimleri görüntüle',
  'notification:update': 'Bildirimi okundu işaretle',
  'notification:delete': 'Bildirim sil',
  'search:global': 'Genel arama yap',
};

// Group ordering — each entry maps a group key to a Turkish label
const PERMISSION_GROUPS: Array<{ key: string; label: string; prefixes: string[] }> = [
  { key: 'general', label: 'Genel Yönetim', prefixes: ['content:', 'settings:', 'search:'] },
  { key: 'users', label: 'Kullanıcı Yönetimi', prefixes: ['user:'] },
  { key: 'roles', label: 'Rol ve Yetki Yönetimi', prefixes: ['role:'] },
  { key: 'tenants', label: 'Müşteri Yönetimi', prefixes: ['tenant:'] },
  { key: 'locations', label: 'Lokasyon Yönetimi', prefixes: ['location:', 'mall:'] },
  { key: 'media', label: 'Medya Yönetimi', prefixes: ['media:'] },
  { key: 'sliders', label: 'Slider Yönetimi', prefixes: ['slider:'] },
  { key: 'pages', label: 'Sayfa Yönetimi', prefixes: ['page:', 'page-block:'] },
  { key: 'events', label: 'Etkinlik Yönetimi', prefixes: ['event:'] },
  { key: 'campaigns', label: 'Kampanya Yönetimi', prefixes: ['campaign:'] },
  { key: 'stores', label: 'Mağaza Yönetimi', prefixes: ['store-category:', 'global-store:', 'mall-store:'] },
  { key: 'cinema', label: 'Sinema Yönetimi', prefixes: ['cinema:', 'movie:', 'movie-session:'] },
  { key: 'analytics', label: 'Analitik / Raporlama', prefixes: ['analytics:'] },
  { key: 'notifications', label: 'Bildirimler', prefixes: ['notification:'] },
  { key: 'localization', label: 'Dil / Çeviri Yönetimi', prefixes: ['locale:', 'translation:'] },
  { key: 'system', label: 'Sistem / Operasyon', prefixes: ['capability:'] },
];

function groupPermissions(perms: RolePermission[]): Array<{ key: string; label: string; perms: RolePermission[] }> {
  const used = new Set<string>();
  const result: Array<{ key: string; label: string; perms: RolePermission[] }> = [];

  for (const group of PERMISSION_GROUPS) {
    const grouped = perms.filter((p) => group.prefixes.some((prefix) => p.code.startsWith(prefix)));
    if (grouped.length > 0) {
      grouped.forEach((p) => used.add(p.id));
      result.push({ key: group.key, label: group.label, perms: grouped });
    }
  }

  const remaining = perms.filter((p) => !used.has(p.id));
  if (remaining.length > 0) {
    result.push({ key: 'other', label: 'Diğer', perms: remaining });
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();

  const [role, setRole] = useState<CmsRole | null>(null);
  const [allPerms, setAllPerms] = useState<RolePermission[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable role info
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [infoDirty, setInfoDirty] = useState(false);

  // Permission filter
  const [searchPerm, setSearchPerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const reload = useCallback(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    Promise.all([apiRoleGet(accessToken, id), apiPermissionsList(accessToken)])
      .then(([r, p]) => {
        setRole(r);
        setAllPerms(p.permissions);
        setSelectedIds(new Set(r.permissions.map((perm) => perm.id)));
        setEditName(r.name);
        setEditDesc(r.description ?? '');
        setEditActive(r.isActive);
        setInfoDirty(false);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  useEffect(() => { reload(); }, [reload]);

  const handleSaveInfo = async () => {
    if (!accessToken || !role) return;
    setSaving(true);
    try {
      await apiRoleUpdate(accessToken, role.id, { name: editName, description: editDesc, isActive: editActive });
      toast.success('Rol bilgileri güncellendi');
      setInfoDirty(false);
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleCancelInfo = () => {
    if (!role) return;
    setEditName(role.name);
    setEditDesc(role.description ?? '');
    setEditActive(role.isActive);
    setInfoDirty(false);
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

  const togglePerm = (permId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      return next;
    });
  };

  const toggleGroup = (perms: RolePermission[]) => {
    const allSel = perms.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSel) perms.forEach((p) => next.delete(p.id));
      else perms.forEach((p) => next.add(p.id));
      return next;
    });
  };

  if (loading) return <PageContainer><div style={{ color: '#6b7280', fontSize: 13 }}>Yükleniyor…</div></PageContainer>;
  if (!role) return <PageContainer><div style={{ color: '#dc2626' }}>Rol bulunamadı</div></PageContainer>;

  const canEdit = can('role:update');
  const isSuperAdmin = user?.isSuperAdmin === true;
  const isEditable = canEdit && (!role.isSystem || isSuperAdmin);

  const permsDirty = !(
    [...selectedIds].every((sid) => role.permissions.some((p) => p.id === sid)) &&
    role.permissions.every((p) => selectedIds.has(p.id))
  );

  // Build grouped permissions for display
  const grouped = groupPermissions(allPerms);

  // Apply search/filter
  const searchLower = searchPerm.toLowerCase();
  const visibleGroups = grouped
    .filter((g) => !filterGroup || g.key === filterGroup)
    .map((g) => ({
      ...g,
      perms: g.perms.filter((p) => {
        if (!searchPerm) return true;
        const label = (PERMISSION_LABELS[p.code] ?? '').toLowerCase();
        return p.code.toLowerCase().includes(searchLower) || label.includes(searchLower);
      }),
    }))
    .filter((g) => g.perms.length > 0);

  return (
    <PageContainer>
      <PageHeader
        title={role.name}
        subtitle={role.isSystem ? 'Sistem Rolü' : `Özel Rol${!role.isActive ? ' · Pasif' : ''}`}
        action={
          <button onClick={() => navigate('/roles')}
            style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#fff' }}>
            ← Geri
          </button>
        }
      />

      {/* Role Info */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Rol Bilgileri</div>
          {role.isSystem && (
            <span style={{ fontSize: 11, padding: '2px 8px', background: '#fff7ed', borderRadius: 10, color: '#c2410c', fontWeight: 700 }}>
              Sistem rolü — sadece Super Admin düzenleyebilir
            </span>
          )}
        </div>

        {isEditable ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px 16px', marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Ad</label>
                <input
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setInfoDirty(true); }}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Kod</label>
                <input
                  value={role.code}
                  disabled
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', color: '#6b7280', background: '#f9fafb', fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Açıklama</label>
                <input
                  value={editDesc}
                  onChange={(e) => { setEditDesc(e.target.value); setInfoDirty(true); }}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => { setEditActive(e.target.checked); setInfoDirty(true); }}
                />
                Aktif
              </label>
              {infoDirty && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button onClick={handleCancelInfo}
                    style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff' }}>
                    İptal
                  </button>
                  <button onClick={handleSaveInfo} disabled={saving || !editName.trim()}
                    style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '6px 16px', fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>Ad</span><span style={{ fontWeight: 500 }}>{role.name}</span>
            <span style={{ color: '#6b7280' }}>Kod</span><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{role.code}</span>
            {role.description && (<><span style={{ color: '#6b7280' }}>Açıklama</span><span>{role.description}</span></>)}
            <span style={{ color: '#6b7280' }}>Durum</span>
            <span style={{ color: role.isActive ? '#16a34a' : '#6b7280', fontWeight: 600 }}>
              {role.isActive ? 'Aktif' : 'Pasif'}
            </span>
            <span style={{ color: '#6b7280' }}>Kullanım</span><span>{role.usageCount} kullanıcı</span>
          </div>
        )}
      </div>

      {/* Permission Matrix */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
            İzin Matrisi
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#6b7280' }}>
              ({selectedIds.size} / {allPerms.length} seçili)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="İzin kodu veya başlık ara…"
              value={searchPerm}
              onChange={(e) => setSearchPerm(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, width: 220 }}
            />
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12 }}
            >
              <option value="">Tüm Gruplar</option>
              {grouped.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
            {isEditable && permsDirty && (
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

        {visibleGroups.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Arama kriterlerine uyan izin bulunamadı
          </div>
        ) : (
          visibleGroups.map((group) => {
            const allSel = group.perms.every((p) => selectedIds.has(p.id));
            const someSel = group.perms.some((p) => selectedIds.has(p.id));
            return (
              <div key={group.key} style={{ marginBottom: 20 }}>
                {/* Group header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #f3f4f6' }}>
                  {isEditable && (
                    <input
                      type="checkbox"
                      checked={allSel}
                      ref={(el) => { if (el) el.indeterminate = !allSel && someSel; }}
                      onChange={() => toggleGroup(group.perms)}
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{group.label}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    ({group.perms.filter((p) => selectedIds.has(p.id)).length}/{group.perms.length})
                  </span>
                </div>

                {/* Permission chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.perms.map((perm) => {
                    const checked = selectedIds.has(perm.id);
                    const label = PERMISSION_LABELS[perm.code];
                    return (
                      <div
                        key={perm.id}
                        onClick={() => isEditable && togglePerm(perm.id)}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          padding: '6px 12px',
                          border: `1px solid ${checked ? '#bfdbfe' : '#e5e7eb'}`,
                          borderRadius: 8,
                          background: checked ? '#eff6ff' : '#fafafa',
                          color: checked ? '#1d4ed8' : '#374151',
                          cursor: isEditable ? 'pointer' : 'default',
                          userSelect: 'none',
                          minWidth: 140,
                        }}
                      >
                        {label && (
                          <span style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</span>
                        )}
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: checked ? '#3b82f6' : '#9ca3af' }}>
                          {perm.code}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {isEditable && permsDirty && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
            <button
              onClick={handleSavePermissions}
              disabled={saving}
              style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {saving ? 'Kaydediliyor…' : 'İzinleri Kaydet'}
            </button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
