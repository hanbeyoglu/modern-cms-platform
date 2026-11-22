import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { UNSAVED_CHANGES_MESSAGE, setUnsavedChanges } from '../lib/unsaved-changes';

/**
 * Protects unsaved form edits against tab close, in-app navigation and
 * tenant/AVM switches (via the shared unsaved-changes registry).
 */
export function useUnsavedChangesGuard(key: string, dirty: boolean): void {
  useEffect(() => {
    setUnsavedChanges(key, dirty);
    return () => setUnsavedChanges(key, false);
  }, [key, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(UNSAVED_CHANGES_MESSAGE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
}
