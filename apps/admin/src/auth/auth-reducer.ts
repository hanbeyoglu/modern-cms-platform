import type { Mall, Tenant } from '../lib/api';
import type { AuthState, AuthUser } from './auth-context';
import { mallsFromMembership } from './mall-context';

export type AuthAction =
  | { type: 'SET_SESSION'; accessToken: string; refreshToken: string; email: string }
  | { type: 'REFRESH_SESSION'; accessToken: string; refreshToken: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'SET_PROFILE'; user: AuthUser; tenants: Tenant[] }
  | { type: 'SET_MALLS'; tenantId: string; malls: Mall[] }
  | { type: 'SET_MALLS_FAILED'; tenantId: string; error: string }
  | { type: 'CLEAR_TENANT_CONTEXT' }
  | { type: 'SELECT_TENANT'; tenantId: string; malls?: Mall[] }
  | { type: 'SELECT_MALL'; mallId: string | null }
  | { type: 'PROFILE_LOADING'; loading: boolean };

function isTenantSelectable(tenant: Tenant): boolean {
  return tenant.status.toUpperCase() !== 'DISABLED';
}

export function resolveActiveMallId(malls: Mall[], currentMallId: string | null): string | null {
  if (malls.length === 0) return null;
  const validIds = new Set(malls.map((mall) => mall.id));
  if (currentMallId && validIds.has(currentMallId)) {
    return currentMallId;
  }
  if (malls.length === 1) {
    return malls[0].id;
  }
  return null;
}

const NO_PENDING = { pendingTenantId: null, pendingMallId: null } as const;

/**
 * A tenant/AVM restored from storage stays in `pendingTenantId` / `pendingMallId`
 * until it is checked against the signed-in user's current access
 * (profile + mall list). Only then does it become active — so no API request
 * is ever sent with an unverified scope, and a revoked scope is dropped.
 */
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'REFRESH_SESSION':
      return { ...state, accessToken: action.accessToken, refreshToken: action.refreshToken };
    case 'SET_SESSION':
      return {
        ...state,
        ...NO_PENDING,
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
        email: action.email,
        user: null,
        tenants: [],
        activeTenantId: null,
        malls: [],
        activeMallId: null,
        profileLoading: true,
        mallsLoading: false,
        mallsError: null,
      };
    case 'CLEAR_SESSION':
      return {
        ...NO_PENDING,
        accessToken: null,
        refreshToken: null,
        email: null,
        user: null,
        tenants: [],
        activeTenantId: null,
        malls: [],
        activeMallId: null,
        profileLoading: false,
        mallsLoading: false,
        mallsError: null,
      };
    case 'SET_PROFILE': {
      const selectableTenants = action.tenants.filter(isTenantSelectable);
      const wantedTenantId = state.activeTenantId ?? state.pendingTenantId;
      const existingTenant = selectableTenants.find((tenant) => tenant.id === wantedTenantId);
      const nextTenantId =
        existingTenant?.id ??
        (!action.user.isSuperAdmin && selectableTenants.length === 1 ? selectableTenants[0].id : null);
      const tenantUnchanged = nextTenantId !== null && nextTenantId === wantedTenantId;
      const wantedMallId = tenantUnchanged ? (state.activeMallId ?? state.pendingMallId) : null;
      const membershipMalls =
        nextTenantId && !action.user.isSuperAdmin ? mallsFromMembership(action.user, nextTenantId) : null;
      const nextMalls =
        membershipMalls ?? (tenantUnchanged && nextTenantId === state.activeTenantId ? state.malls : []);
      // Super admins get their mall list from /malls/my: keep the wanted mall pending until it arrives.
      const waitForMalls = Boolean(nextTenantId && action.user.isSuperAdmin && nextMalls.length === 0);
      return {
        ...state,
        user: action.user,
        tenants: action.tenants,
        activeTenantId: nextTenantId,
        pendingTenantId: null,
        malls: nextMalls,
        activeMallId: waitForMalls ? null : resolveActiveMallId(nextMalls, wantedMallId),
        pendingMallId: waitForMalls ? wantedMallId : null,
        profileLoading: false,
        mallsLoading: waitForMalls,
        mallsError: tenantUnchanged ? state.mallsError : null,
      };
    }
    case 'SET_MALLS': {
      if (action.tenantId !== state.activeTenantId) {
        return state;
      }
      return {
        ...state,
        malls: action.malls,
        activeMallId: resolveActiveMallId(action.malls, state.activeMallId ?? state.pendingMallId),
        pendingMallId: null,
        mallsLoading: false,
        mallsError: null,
      };
    }
    case 'SET_MALLS_FAILED': {
      if (action.tenantId !== state.activeTenantId) {
        return state;
      }
      return {
        ...state,
        malls: [],
        activeMallId: null,
        pendingMallId: null,
        mallsLoading: false,
        mallsError: action.error,
      };
    }
    case 'CLEAR_TENANT_CONTEXT':
      return {
        ...state,
        ...NO_PENDING,
        activeTenantId: null,
        malls: [],
        activeMallId: null,
        mallsLoading: false,
        mallsError: null,
      };
    case 'SELECT_TENANT': {
      const malls = action.malls ?? [];
      return {
        ...state,
        ...NO_PENDING,
        activeTenantId: action.tenantId,
        malls,
        activeMallId: resolveActiveMallId(malls, state.activeMallId),
        mallsLoading: action.malls === undefined && action.tenantId.length > 0,
        mallsError: null,
      };
    }
    case 'SELECT_MALL':
      return { ...state, activeMallId: action.mallId, pendingMallId: null };
    case 'PROFILE_LOADING':
      return { ...state, profileLoading: action.loading };
    default:
      return state;
  }
}
