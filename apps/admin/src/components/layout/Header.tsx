import { UserMenu } from './UserMenu';
import { TenantMallSelector } from '../TenantMallSelector';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';

export function Header() {
  return (
    <header
      style={{
        height: 56,
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
        <TenantMallSelector />
        <GlobalSearch />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
