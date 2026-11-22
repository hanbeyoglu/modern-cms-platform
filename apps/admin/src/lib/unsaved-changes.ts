/**
 * Lightweight registry of forms that currently hold unsaved edits.
 * Lets code outside the form (e.g. the tenant/AVM switcher) ask the user
 * before an action that would discard those edits.
 */
const dirtyKeys = new Set<string>();

export const UNSAVED_CHANGES_MESSAGE =
  'Kaydedilmemiş değişiklikleriniz kaybolacak. Devam etmek istiyor musunuz?';

export function setUnsavedChanges(key: string, dirty: boolean): void {
  if (dirty) dirtyKeys.add(key);
  else dirtyKeys.delete(key);
}

export function hasUnsavedChanges(): boolean {
  return dirtyKeys.size > 0;
}

/** Returns true when it is safe to continue (nothing dirty, or the user accepted). */
export function confirmDiscardUnsavedChanges(
  confirmFn: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  if (!hasUnsavedChanges()) return true;
  return confirmFn(UNSAVED_CHANGES_MESSAGE);
}
