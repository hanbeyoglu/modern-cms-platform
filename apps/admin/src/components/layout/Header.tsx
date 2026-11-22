import type { RefObject } from 'react';
import { UserMenu } from './UserMenu';
import { TenantMallSelector } from '../TenantMallSelector';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';

interface HeaderProps {
  menuOpen: boolean;
  onMenuToggle: () => void;
  menuButtonRef: RefObject<HTMLButtonElement>;
}

export function Header({ menuOpen, onMenuToggle, menuButtonRef }: HeaderProps) {
  return (
    <header className="cms-header">
      <div className="cms-header__start">
        <button
          ref={menuButtonRef}
          type="button"
          className="cms-menu-button"
          aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={menuOpen}
          aria-controls="cms-sidebar"
          onClick={onMenuToggle}
        >
          ☰
        </button>
        <TenantMallSelector />
        <div className="cms-hide-sm" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <GlobalSearch />
        </div>
      </div>
      <div className="cms-header__end">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
