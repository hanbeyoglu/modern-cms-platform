import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import './auth-layout.css';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { accessToken, profileLoading } = useAuth();
  if (accessToken && !profileLoading) return <Navigate to="/dashboard" replace />;

  return (
    <main className="cms-auth">
      <section className="cms-auth__story" aria-label="Modern CMS">
        <div className="cms-auth__brand"><span className="cms-auth__mark" aria-hidden="true">m<span>.</span></span>modern<span className="cms-auth__brand-light">cms</span></div>
        <div className="cms-auth__intro">
          <div className="cms-auth__eyebrow"><span />DENEYİMİN YÖNETİM MERKEZİ</div>
          <h1>Her içerik,<br />{' '}yeni bir <em>deneyim.</em></h1>
          <p>Mekânınızın dijital dünyasını bir araya getirin.<br className="cms-auth__desktop-break" /> İçeriklerinizi yönetin, ziyaretçilerinize ilham verin.</p>
        </div>
        <div className="cms-auth__art" aria-hidden="true">
          <svg viewBox="0 0 600 310" fill="none">
            <defs>
              <linearGradient id="auth-line" x1="70" y1="0" x2="520" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#8BAEF9" /><stop offset="1" stopColor="#375C9D" stopOpacity=".2" /></linearGradient>
              <linearGradient id="auth-building" x1="250" y1="50" x2="400" y2="260" gradientUnits="userSpaceOnUse"><stop stopColor="#213D69" /><stop offset="1" stopColor="#122743" /></linearGradient>
            </defs>
            <path d="M50 215 300 75l250 140-250 140L50 215Z" stroke="#49678C" strokeOpacity=".3" />
            <path d="M98 186 300 72l202 114-202 114L98 186Z" fill="#132B4A" stroke="url(#auth-line)" />
            <path d="m160 179 140-80 140 80-140 80-140-80Z" stroke="#5E82AD" strokeOpacity=".3" />
            <path d="M225 159V87l75-43 75 43v72l-75 44-75-44Z" fill="url(#auth-building)" stroke="#6B90BF" />
            <path d="m225 87 75 44 75-44M300 131v72" stroke="#6B90BF" />
            <path d="m245 101 35 20v43l-35-20v-43Zm75 20 35-20v43l-35 20v-43Z" fill="#456998" fillOpacity=".35" />
            <path d="m145 206 81 47 42-24M371 171l61 35 47-26" stroke="#DCC19A" strokeWidth="2" strokeLinecap="round" />
            <circle cx="145" cy="206" r="5" fill="#E9CAA1" /><circle cx="479" cy="180" r="5" fill="#E9CAA1" />
            <path d="M177 151v-39m0 0 12 7m-12-7-12 7M423 150v-39m0 0 12 7m-12-7-12 7" stroke="#8BAEF9" strokeOpacity=".6" strokeLinecap="round" />
            <circle cx="300" cy="44" r="5" fill="#A7C5F4" />
          </svg>
          <span className="cms-auth__art-label">İÇERİK <span>—</span> MEKÂN <span>—</span> DENEYİM</span>
        </div>
        <div className="cms-auth__story-footer"><span>Tek platform. Bütün deneyim.</span><span className="cms-auth__edition">MODERN CMS</span></div>
      </section>
      <section className="cms-auth__access" aria-label="Yönetici girişi">
        <div className="cms-auth__access-top"><span>İçerik yönetimi, yeniden düşünüldü.</span><span aria-hidden="true">↗</span></div>
        <div className="cms-auth__form-container">{children}</div>
        <footer className="cms-auth__footer"><span>Modern CMS</span><span>Yönetici erişimi</span></footer>
      </section>
    </main>
  );
}
