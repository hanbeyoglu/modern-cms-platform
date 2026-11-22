const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
].join(', ');

/** Brings an inline form into view (it renders above the list). */
export function scrollFormIntoView(el: HTMLElement | null): void {
  if (!el) return;
  window.requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/**
 * Focuses the first editable field inside `section`, unless the user is
 * already working inside `container`.
 */
export function focusFirstField(section: HTMLElement | null, container: HTMLElement | null): void {
  if (!section) return;
  const active = document.activeElement;
  if (container && active && active !== document.body && container.contains(active)) return;
  const field = section.querySelector<HTMLElement>(FIELD_SELECTOR);
  field?.focus({ preventScroll: true });
}

/** Form save error text for non-technical users; form data stays in place. */
export function describeSaveError(err: unknown): string {
  if (err instanceof TypeError) {
    return 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin; girdiğiniz bilgiler korunuyor.';
  }
  return err instanceof Error && err.message ? err.message : 'Kayıt başarısız. Lütfen tekrar deneyin.';
}
