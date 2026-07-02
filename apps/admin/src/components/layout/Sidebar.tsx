import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, NAV_GROUPS, type NavItem } from '../../navigation/config';
import { usePermission } from '../../hooks/usePermission';
import { useCapability } from '../../hooks/useCapability';
import { useAuth } from '../../auth/useAuth';
import { isAuditEnabled } from '../../lib/feature-flags';
import { BrandAvatar } from '../ui/BrandAvatar';
import {
  formatContextLabel,
  resolveSidebarBrandImage,
  resolveSidebarBrandName,
} from '../../lib/branding';

const SIDEBAR_WIDTH = 220;

export function Sidebar() {
  const { can, canAny } = usePermission();
  const { has } = useCapability();
  const { user, tenants, malls, activeTenantId, activeMallId } = useAuth();

  const activeTenant = tenants.find((tenant) => tenant.id === activeTenantId);
  const activeMall = malls.find((mall) => mall.id === activeMallId);
  const brandImageUrl = resolveSidebarBrandImage(activeTenant, activeMall);
  const brandName = resolveSidebarBrandName(activeTenant, activeMall);
  const contextLabel = formatContextLabel(activeTenant, activeMall);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.requiresAudit && !isAuditEnabled()) return false;
    if (item.superAdminOnly && !user?.isSuperAdmin) return false;
    if (item.anyPermission && item.anyPermission.length > 0) {
      if (!canAny(...item.anyPermission)) return false;
    } else if (item.permission !== null && !can(item.permission)) return false;
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
          padding: '14px 18px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'grid',
          gap: 10,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: '#111827',
            letterSpacing: '-0.3px',
          }}
        >
          CMS Admin
        </div>
        {(activeTenant || activeMall) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <BrandAvatar
              name={brandName || contextLabel}
              imageUrl={brandImageUrl}
              size={32}
            />
            <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#374151',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={contextLabel}
              >
                {contextLabel}
              </span>
            </div>
          </div>
        )}
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
            <GroupNavItems items={items} />
          </div>
        ))}
      </nav>
    </aside>
  );
}

function GroupNavItems({ items }: { items: NavItem[] }) {
  const rootItems = items.filter((item) => !item.subgroup);
  const subgroups = [
    ...new Set(items.map((item) => item.subgroup).filter((s): s is string => Boolean(s))),
  ];

  return (
    <>
      {rootItems.map((item) => (
        <SidebarItem key={item.id} id={item.id} icon={item.icon} label={item.label} href={item.href} />
      ))}
      {subgroups.map((subgroup) => (
        <div key={subgroup}>
          <div
            style={{
              padding: '8px 18px 4px 26px',
              fontSize: 10,
              fontWeight: 600,
              color: '#b0b7c3',
              letterSpacing: '0.3px',
            }}
          >
            {subgroup}
          </div>
          {items
            .filter((item) => item.subgroup === subgroup)
            .map((item) => (
              <SidebarItem
                key={item.id}
                id={item.id}
                icon={item.icon}
                label={item.label}
                href={item.href}
                indent
              />
            ))}
        </div>
      ))}
    </>
  );
}

function SidebarItem({
  icon,
  label,
  href,
  indent = false,
}: {
  id: string;
  icon: string;
  label: string;
  href: string;
  indent?: boolean;
}) {
  return (
    <NavLink
      to={href}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 18px',
        paddingLeft: indent ? 34 : 18,
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
