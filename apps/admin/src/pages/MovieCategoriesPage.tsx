import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { apiMovieCategoriesList, type MovieCategory } from '../lib/api';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';

export function MovieCategoriesPage() {
  const { accessToken, activeTenantId } = useAuth();
  const [categories, setCategories] = useState<MovieCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    apiMovieCategoriesList(accessToken, activeTenantId)
      .then(setCategories)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, activeTenantId]);

  return (
    <PageContainer>
      <PageHeader title="Film Kategorileri" subtitle="Tenant film türleri / kategorileri" />
      {loading ? (
        <LoadingState />
      ) : (
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Ad</th>
              <th style={{ padding: 8 }}>Slug</th>
              <th style={{ padding: 8 }}>Sıra</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 8 }}>{c.name}</td>
                <td style={{ padding: 8, color: '#6b7280' }}>{c.slug}</td>
                <td style={{ padding: 8 }}>{c.sortOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageContainer>
  );
}
