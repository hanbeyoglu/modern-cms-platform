import type { Mall } from '../lib/api';
import type { AuthUser } from './auth-context';

/** Build mall context from /auth/me memberships (no admin permission required). */
export function mallsFromMembership(user: AuthUser, tenantId: string): Mall[] {
  const membership = user.memberships?.find((m) => m.tenantId === tenantId);
  if (!membership) return [];

  return membership.malls.map((m) => ({
    id: m.id,
    tenantId,
    name: m.name,
    slug: m.slug,
    status: m.status ?? 'LIVE',
    type: m.type,
    logoMedia: m.logoMedia ?? null,
    coverMedia: m.coverMedia ?? null,
  }));
}
