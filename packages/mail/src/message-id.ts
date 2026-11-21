/** Deterministic RFC Message-ID for a contact notification (provider-side dedupe best-effort). */
export function contactEmailRfcMessageId(messageId: string, domain = 'contact.modern-cms.local'): string {
  const safe = messageId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `<contact-${safe}@${domain}>`;
}

export function contactEmailDispatchId(messageId: string): string {
  return `contact-email:${messageId}`;
}
