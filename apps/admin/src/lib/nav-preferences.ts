/** Per-user open/closed state of sidebar groups (keys: group id or "group/subgroup"). */
export type NavOpenState = Record<string, boolean>;

const PREFIX = 'cms.nav.open.';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadNavOpenState(userId: string | undefined, store: StorageLike | null = storage()): NavOpenState {
  if (!userId || !store) return {};
  try {
    const raw = store.getItem(PREFIX + userId);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: NavOpenState = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveNavOpenState(
  userId: string | undefined,
  state: NavOpenState,
  store: StorageLike | null = storage(),
): void {
  if (!userId || !store) return;
  try {
    store.setItem(PREFIX + userId, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the menu still works, it just won't remember.
  }
}

export function isSectionOpen(state: NavOpenState, key: string, defaultOpen: boolean): boolean {
  return state[key] ?? defaultOpen;
}
