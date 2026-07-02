import { useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import {
  apiCampaignsList,
  apiEventsList,
  apiLocationsList,
  apiMallStoresList,
  type CmsCampaign,
  type CmsEvent,
  type CmsLocation,
  type MallStore,
  type SliderPlacementType,
  API_MAX_PAGE_SIZE,
} from '../lib/api';
import { ENTITY_SLIDER_PLACEMENTS } from '../lib/slider-form-validation';

function logEntityOptions(
  placementType: SliderPlacementType,
  tenantId: string,
  mallId: string | null,
  payload: Record<string, unknown>,
): void {
  console.debug('[slider-entity-options]', {
    placementType,
    tenantId,
    mallId,
    ...payload,
  });
}

export function mallStoreLabel(store: MallStore): string {
  const name = store.globalStore.name;
  return store.floor ? `${name} (${store.floor})` : name;
}

export function locationLabel(location: CmsLocation): string {
  return location.displayName || location.name;
}

export function useSliderEntityOptions(placementType: SliderPlacementType | null, enabled = true) {
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<CmsCampaign[]>([]);
  const [events, setEvents] = useState<CmsEvent[]>([]);
  const [stores, setStores] = useState<MallStore[]>([]);
  const [locations, setLocations] = useState<CmsLocation[]>([]);

  useEffect(() => {
    if (!enabled || !accessToken || !activeTenantId || !placementType) return;
    if (!ENTITY_SLIDER_PLACEMENTS.includes(placementType)) return;

    let cancelled = false;
    setOptionsLoading(true);

    const load = async () => {
      try {
        if (placementType === 'CAMPAIGN') {
          const res = await apiCampaignsList(accessToken, activeTenantId, {
            mallId: activeMallId ?? undefined,
            limit: API_MAX_PAGE_SIZE,
          });
          logEntityOptions(placementType, activeTenantId, activeMallId, {
            endpoint: 'GET /campaigns',
            responseKey: 'campaigns',
            count: res.campaigns.length,
            sample: res.campaigns[0]
              ? { id: res.campaigns[0].id, title: res.campaigns[0].title }
              : null,
          });
          if (!cancelled) setCampaigns(res.campaigns);
          return;
        }

        if (placementType === 'EVENT') {
          const res = await apiEventsList(accessToken, activeTenantId, {
            mallId: activeMallId ?? undefined,
            limit: API_MAX_PAGE_SIZE,
          });
          logEntityOptions(placementType, activeTenantId, activeMallId, {
            endpoint: 'GET /events',
            responseKey: 'events',
            count: res.events.length,
            sample: res.events[0]
              ? { id: res.events[0].id, title: res.events[0].title }
              : null,
          });
          if (!cancelled) setEvents(res.events);
          return;
        }

        if (placementType === 'STORE') {
          if (!activeMallId) {
            logEntityOptions(placementType, activeTenantId, activeMallId, {
              endpoint: 'GET /mall-stores',
              skipped: 'missing mallId',
              count: 0,
            });
            if (!cancelled) setStores([]);
            return;
          }
          const res = await apiMallStoresList(accessToken, activeTenantId, activeMallId, {
            limit: API_MAX_PAGE_SIZE,
            status: 'ACTIVE',
          });
          logEntityOptions(placementType, activeTenantId, activeMallId, {
            endpoint: 'GET /mall-stores',
            responseKey: 'items',
            count: res.items.length,
            sample: res.items[0]
              ? { id: res.items[0].id, name: mallStoreLabel(res.items[0]) }
              : null,
          });
          if (!cancelled) setStores(res.items);
          return;
        }

        if (placementType === 'LOCATION') {
          const res = await apiLocationsList(accessToken, {
            tenantId: activeTenantId,
          });
          logEntityOptions(placementType, activeTenantId, activeMallId, {
            endpoint: 'GET /locations?tenantId=…',
            responseKey: 'locations',
            count: res.locations.length,
            sample: res.locations[0]
              ? { id: res.locations[0].id, name: locationLabel(res.locations[0]) }
              : null,
          });
          if (!cancelled) setLocations(res.locations);
        }
      } catch (err) {
        console.debug('[slider-entity-options] load failed', {
          placementType,
          tenantId: activeTenantId,
          mallId: activeMallId,
          error: err instanceof Error ? err.message : String(err),
        });
        if (!cancelled) {
          setCampaigns([]);
          setEvents([]);
          setStores([]);
          setLocations([]);
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, accessToken, activeTenantId, activeMallId, placementType]);

  return {
    optionsLoading,
    campaigns,
    events,
    stores,
    locations,
  };
}
