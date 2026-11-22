import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { useAuth } from '../auth/useAuth';

const DRAWER_QUERY = '(max-width: 1023px)';

function useIsDrawer(): boolean {
  const [isDrawer, setIsDrawer] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DRAWER_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(DRAWER_QUERY);
    const onChange = () => setIsDrawer(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isDrawer;
}

export function DashboardLayout() {
  const { profileLoading } = useAuth();
  const isDrawer = useIsDrawer();
  const [navOpen, setNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const closeNav = useCallback(() => {
    setNavOpen((wasOpen) => {
      if (wasOpen) window.setTimeout(() => menuButtonRef.current?.focus(), 0);
      return false;
    });
  }, []);

  useEffect(() => {
    if (!isDrawer) setNavOpen(false);
  }, [isDrawer]);

  // While the drawer is open the page behind it is not reachable by keyboard or screen reader.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (isDrawer && navOpen) main.setAttribute('inert', '');
    else main.removeAttribute('inert');
  }, [isDrawer, navOpen]);

  // Keep the page behind the drawer from scrolling.
  useEffect(() => {
    if (!(isDrawer && navOpen)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDrawer, navOpen]);

  if (profileLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#6b7280',
          fontSize: 14,
        }}
      >
        Profil yükleniyor…
      </div>
    );
  }

  return (
    <div className={`cms-shell${isDrawer && navOpen ? ' cms-shell--nav-open' : ''}`}>
      <Header
        menuOpen={navOpen}
        onMenuToggle={() => (navOpen ? closeNav() : setNavOpen(true))}
        menuButtonRef={menuButtonRef}
      />
      <div className="cms-shell__body">
        <Sidebar open={navOpen} isDrawer={isDrawer} onClose={closeNav} />
        <main className="cms-main" ref={mainRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
