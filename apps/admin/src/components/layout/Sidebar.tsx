import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { contactMessagesCount } from '../../lib/api/contact-messages';
import {
  NAV_GROUPS,
  NAV_ITEMS,
  NAV_SUBGROUP_DEFAULT_OPEN,
  isNavItemActive,
  isNavItemVisible,
  type NavItem,
} from '../../navigation/config';
import { usePermission } from '../../hooks/usePermission';
import { useCapability } from '../../hooks/useCapability';
import { useAuth } from '../../auth/useAuth';
import { isAuditEnabled } from '../../lib/feature-flags';
import {
  isSectionOpen,
  loadNavOpenState,
  saveNavOpenState,
  type NavOpenState,
} from '../../lib/nav-preferences';

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface SidebarProps {
  /** Drawer mode (tablet/phone) is open. Ignored on desktop where the sidebar is always shown. */
  open: boolean;
  /** True below the desktop breakpoint, where the sidebar is a drawer. */
  isDrawer: boolean;
  onClose: () => void;
}

export function Sidebar({ open, isDrawer, onClose }: SidebarProps) {
  const { can, canAny } = usePermission();
  const { has } = useCapability();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const asideRef = useRef<HTMLElement>(null);

  const visibleItems = NAV_ITEMS.filter((item) =>
    isNavItemVisible(item, {
      isSuperAdmin: Boolean(user?.isSuperAdmin),
      auditEnabled: isAuditEnabled(),
      can,
      canAny,
      hasCapability: has,
    }),
  );

  const ungrouped = visibleItems.filter((item) => !item.group);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: visibleItems.filter((item) => item.group === group.id),
  })).filter((g) => g.items.length > 0);

  const activeItem = visibleItems.find((item) => isNavItemActive(item, pathname));

  const [openState, setOpenState] = useState<NavOpenState>(() => loadNavOpenState(user?.id));
  useEffect(() => {
    setOpenState(loadNavOpenState(user?.id));
  }, [user?.id]);

  function setSection(key: string, value: boolean) {
    setOpenState((prev) => {
      const next = { ...prev, [key]: value };
      saveNavOpenState(user?.id, next);
      return next;
    });
  }

  // The active page's group (and sub-group) always opens when you land on it.
  useEffect(() => {
    if (!activeItem?.group) return;
    const groupCfg = NAV_GROUPS.find((g) => g.id === activeItem.group);
    if (groupCfg && !isSectionOpen(openState, groupCfg.id, groupCfg.defaultOpen)) {
      setSection(groupCfg.id, true);
    }
    if (activeItem.subgroup) {
      const key = `${activeItem.group}/${activeItem.subgroup}`;
      if (!isSectionOpen(openState, key, NAV_SUBGROUP_DEFAULT_OPEN)) setSection(key, true);
    }
    // Only react to navigation, not to manual toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.id]);

  // Drawer: move focus inside on open, lock it there, close with Escape.
  useEffect(() => {
    if (!isDrawer || !open) return;
    const aside = asideRef.current;
    const current = aside?.querySelector<HTMLElement>('[aria-current="page"]');
    (current ?? aside?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  }, [isDrawer, open]);

  function onKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (!isDrawer || !open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...(asideRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
      (n) => n.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const hiddenDrawer = isDrawer && !open;

  return (
    <>
      <div
        className={`cms-backdrop${isDrawer && open ? ' cms-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={asideRef}
        id="cms-sidebar"
        className={`cms-sidebar${isDrawer && open ? ' cms-sidebar--open' : ''}`}
        aria-label="Ana menü"
        {...(isDrawer ? { role: 'dialog', 'aria-modal': open ? true : undefined } : {})}
        aria-hidden={hiddenDrawer ? true : undefined}
        onKeyDown={onKeyDown}
      >
        <div className="cms-sidebar__brand">
          <span>CMS Admin</span>
          <button
            type="button"
            className="cms-sidebar__close"
            onClick={onClose}
            aria-label="Menüyü kapat"
            tabIndex={hiddenDrawer ? -1 : 0}
          >
            ✕
          </button>
        </div>

        <nav className="cms-nav" aria-label="Ana menü bağlantıları">
          {ungrouped
            .filter((item) => item.id !== 'account')
            .map((item) => (
              <SidebarItem key={item.id} item={item} pathname={pathname} onNavigate={onClose} />
            ))}
          {groups.map((group) => {
            const isOpen = isSectionOpen(openState, group.id, group.defaultOpen);
            const panelId = `cms-nav-${slug(group.id)}`;
            return (
              <div key={group.id} className="cms-nav__group">
                <button
                  type="button"
                  className="cms-nav__group-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setSection(group.id, !isOpen)}
                >
                  <span>{group.id}</span>
                  <span className={`cms-nav__chevron${isOpen ? ' cms-nav__chevron--open' : ''}`} aria-hidden="true">
                    ▶
                  </span>
                </button>
                <div id={panelId} hidden={!isOpen}>
                  <GroupItems
                    groupId={group.id}
                    items={group.items}
                    pathname={pathname}
                    openState={openState}
                    onToggle={setSection}
                    onNavigate={onClose}
                  />
                </div>
              </div>
            );
          })}
        </nav>

        {ungrouped.some((item) => item.id === 'account') && (
          <div className="cms-sidebar__footer">
            {ungrouped
              .filter((item) => item.id === 'account')
              .map((item) => (
                <SidebarItem key={item.id} item={item} pathname={pathname} onNavigate={onClose} />
              ))}
          </div>
        )}
      </aside>
    </>
  );
}

function slug(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-');
}

function GroupItems({
  groupId,
  items,
  pathname,
  openState,
  onToggle,
  onNavigate,
}: {
  groupId: string;
  items: NavItem[];
  pathname: string;
  openState: NavOpenState;
  onToggle: (key: string, value: boolean) => void;
  onNavigate: () => void;
}) {
  const rootItems = items.filter((item) => !item.subgroup);
  const subgroups = [
    ...new Set(items.map((item) => item.subgroup).filter((s): s is string => Boolean(s))),
  ];

  return (
    <>
      {rootItems.map((item) => (
        <SidebarItem key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
      {subgroups.map((subgroup) => {
        const key = `${groupId}/${subgroup}`;
        const isOpen = isSectionOpen(openState, key, NAV_SUBGROUP_DEFAULT_OPEN);
        const panelId = `cms-nav-${slug(key)}`;
        return (
          <div key={subgroup}>
            <button
              type="button"
              className="cms-nav__subgroup-toggle"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => onToggle(key, !isOpen)}
            >
              <span>{subgroup}</span>
              <span className={`cms-nav__chevron${isOpen ? ' cms-nav__chevron--open' : ''}`} aria-hidden="true">
                ▶
              </span>
            </button>
            <div id={panelId} hidden={!isOpen}>
              {items
                .filter((item) => item.subgroup === subgroup)
                .map((item) => (
                  <SidebarItem key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} indent />
                ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function SidebarItem({
  item,
  pathname,
  onNavigate,
  indent = false,
}: {
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
  indent?: boolean;
}) {
  const active = isNavItemActive(item, pathname);
  return (
    <Link
      to={item.href}
      className={`cms-nav__item${indent ? ' cms-nav__item--indent' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      <span className="cms-nav__icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="cms-nav__label">{item.label}</span>
      {item.id === 'contact-messages' && <ContactMessageBadge />}
    </Link>
  );
}

function ContactMessageBadge() {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const { can } = usePermission();
  const allowed = can('contact-message:read');
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(null);
    if (!allowed || !accessToken || !activeTenantId || !activeMallId) return;
    let disposed = false;
    const refresh = () => {
      void contactMessagesCount(accessToken, activeTenantId, activeMallId)
        .then((data) => {
          if (!disposed) setCount(data.count);
        })
        .catch(() => {
          if (!disposed) setCount(null);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('cms:contact-messages-changed', refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('cms:contact-messages-changed', refresh);
    };
  }, [allowed, accessToken, activeTenantId, activeMallId]);
  if (!count) return null;
  return (
    <span className="cms-nav__badge" aria-label={`${count} okunmamış mesaj`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
