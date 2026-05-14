import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, NAV_GROUPS } from '../../navigation/config';
import { usePermission } from '../../hooks/usePermission';
import { useCapability } from '../../hooks/useCapability';
import { useAuth } from '../../auth/useAuth';

const SIDEBAR_WIDTH = 220;

export function Sidebar() {
  const { can } = usePermission();
  const { has } = useCapability();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly && !user?.isSuperAdmin) return false;
    if (item.permission !== null && !can(item.permission)) return false;
    if (item.capability && !user?.isSuperAdmin && !has(item.capability)) return false;
    return true;
  });

  const ungrouped = visibleItems.filter((item) => !item.group);
  const grouped = NAV_GROUPS.map((group) => ({
    group,
    items: visibleItems.filter((item) => item.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        borderRight: '1px solid #e5e7eb',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 700,
          fontSize: 15,
          color: '#111827',
          letterSpacing: '-0.3px',
        }}
      >
        CMS Admin
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {ungrouped.map((item) => (
          <SidebarItem key={item.id} id={item.id} icon={item.icon} label={item.label} href={item.href} />
        ))}

        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div
              style={{
                padding: '12px 18px 4px',
                fontSize: 10,
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {group}
            </div>
            {items.map((item) => (
              <SidebarItem key={item.id} id={item.id} icon={item.icon} label={item.label} href={item.href} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  href,
}: {
  id: string;
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <NavLink
      to={href}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 18px',
        fontSize: 13,
        color: isActive ? '#2563eb' : '#374151',
        background: isActive ? '#eff6ff' : 'transparent',
        textDecoration: 'none',
        borderRight: isActive ? '3px solid #2563eb' : '3px solid transparent',
        fontWeight: isActive ? 600 : 400,
        transition: 'background 0.1s',
      })}
    >
      <span style={{ fontSize: 14, opacity: 0.8 }}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
