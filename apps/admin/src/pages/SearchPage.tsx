import { GlobalSearch } from '../components/layout/GlobalSearch';

export function SearchPage() {
  return (
    <div style={{ padding: 24, maxWidth: 880, minWidth: 0 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600 }}>Genel arama</h1>
      <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
        Seçili çalışma alanınızdaki sayfaları, etkinlikleri, kampanyaları, mağazaları, filmleri,
        sinemaları ve slaytları tek yerden bulun. Aramaya ⌘K / Ctrl+K ile ulaşabilirsiniz.
      </p>
      <GlobalSearch variant="page" />
    </div>
  );
}
