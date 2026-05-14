import { GlobalSearch } from '../components/layout/GlobalSearch';

export function SearchPage() {
  return (
    <div style={{ padding: 24, maxWidth: 880 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>Genel arama</h1>
      <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
        Sayfalar, etkinlikler, kampanyalar, mağazalar, filmler, sinemalar ve sliderlar arasında
        PostgreSQL tam metin indeksine göre arama yapılır. Üst çubuktaki kısayol ile de
        (⌘K / Ctrl+K) odaklanabilirsiniz.
      </p>
      <GlobalSearch variant="page" />
    </div>
  );
}
