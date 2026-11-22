import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogin } from '../lib/api';
import { useAuth } from '../auth/useAuth';

function LoginIcon({ kind }: { kind: 'email' | 'lock' | 'eye' | 'eye-off' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></> : kind === 'lock' ? <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></> : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{kind === 'eye-off' && <path d="m3 3 18 18" />}</>}
  </svg>;
}

export function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await apiLogin(email.trim(), password);
      setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, email: res.user.email });
      void navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/fetch|network|ulaşılam|500|502|503|504/i.test(message)
        ? 'Şu anda sunucuya ulaşılamıyor. Lütfen biraz sonra tekrar deneyin.'
        : /429|too many|çok fazla/i.test(message)
          ? 'Çok fazla giriş denemesi yapıldı. Lütfen bir süre bekleyip tekrar deneyin.'
          : 'Giriş yapılamadı. E-posta adresinizi ve şifrenizi kontrol edip tekrar deneyin.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }
  const checkCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState('CapsLock'));

  return (
    <>
      <div className="cms-login__heading">
        <span className="cms-login__eyebrow">YÖNETİM PANELİ</span>
        <h2>Hoş geldiniz.</h2>
        <p>Yeni deneyimler oluşturmak için hesabınıza giriş yapın.</p>
      </div>
      <form className="cms-login__form" onSubmit={e => void onSubmit(e)} aria-busy={loading}>
        <div className="cms-login__field">
          <label htmlFor="login-email">E-posta adresi</label>
          <div className="cms-login__input-wrap">
            <LoginIcon kind="email" />
            <input id="login-email" name="email" value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={loading} placeholder="adiniz@sirket.com" aria-describedby={error ? 'login-error' : undefined} />
          </div>
        </div>
        <div className="cms-login__field">
          <label htmlFor="login-password">Şifre</label>
          <div className="cms-login__input-wrap">
            <LoginIcon kind="lock" />
            <input id="login-password" name="password" value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={8} disabled={loading} placeholder="Şifrenizi girin" onKeyDown={checkCapsLock} onKeyUp={checkCapsLock} onBlur={() => setCapsLock(false)} aria-describedby={[capsLock ? 'login-caps-lock' : '', error ? 'login-error' : ''].filter(Boolean).join(' ') || undefined} />
            <button className="cms-login__visibility" type="button" aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} aria-pressed={showPassword} aria-controls="login-password" disabled={loading} onClick={() => setShowPassword(value => !value)}><LoginIcon kind={showPassword ? 'eye-off' : 'eye'} /></button>
          </div>
          {capsLock && <span className="cms-login__caps" id="login-caps-lock" role="status">Caps Lock açık.</span>}
        </div>
        {error && <div className="cms-login__error" id="login-error" role="alert">{error}</div>}
        <button className="cms-login__submit" type="submit" disabled={loading}>
          {loading ? <><span className="cms-login__spinner" aria-hidden="true" />Giriş yapılıyor…</> : <>Giriş yap<span aria-hidden="true">↗</span></>}
        </button>
        <div className="cms-login__help"><span className="cms-login__help-line" /><span>Hesabınıza erişemiyor musunuz?</span><span className="cms-login__help-line" /></div>
        <p className="cms-login__support">Hesap ve erişim desteği için kurumunuzun<br />sistem yöneticisiyle iletişime geçin.</p>
      </form>
    </>
  );
}
