import { useEffect, useState } from 'react';
import { apiContentLocales } from '../lib/api/location-locales';
import type { CmsLocale } from '../lib/api/locales';

/**
 * Tenant-wide locales when mallId is absent; location-active locales when mallId is set.
 */
export function useLocationLocales(
  accessToken: string | undefined,
  tenantId: string | undefined,
  mallId: string | undefined | null,
) {
  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken || !tenantId) {
      setLocales([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await apiContentLocales(accessToken, tenantId, mallId);
        if (!cancelled) setLocales(rows);
      } catch {
        if (!cancelled) setLocales([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, tenantId, mallId]);

  return { locales, loading };
}
