import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { apiMediaGuidelinesList, type MediaGuideline } from '../lib/api/media-guidelines';
import { MEDIA_CONTEXTS, type MediaContextPreset, type MediaUsageContextKey } from '../lib/media-contexts';

export function resolveMediaPreset(
  context: MediaUsageContextKey,
  guidelines: MediaGuideline[] | null,
): MediaContextPreset {
  const fallback = MEDIA_CONTEXTS[context];
  const row = guidelines?.find((g) => g.usageKey === context);
  if (!row || !row.active || row.source === 'default') return fallback;

  return {
    key: context,
    label: row.label,
    recommendedWidth: row.recommendedWidth,
    recommendedHeight: row.recommendedHeight,
    acceptedMime: row.acceptedMimeTypes.join(', ') || fallback.acceptedMime,
    helperText: row.helperText,
    aspectRatioLocked: row.aspectRatioLocked,
  };
}

export function useMediaGuidelines() {
  const { accessToken, activeTenantId } = useAuth();
  const [guidelines, setGuidelines] = useState<MediaGuideline[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId) {
      setGuidelines(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiMediaGuidelinesList(accessToken, activeTenantId);
      setGuidelines(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Medya ayarları yüklenemedi');
      setGuidelines(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { guidelines, loading, error, reload: load };
}
