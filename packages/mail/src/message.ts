/** Strip control characters and normalize newlines for plain-text email bodies. */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

export type ContactNotificationContent = {
  mallName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string | null;
  subject?: string | null;
  message: string;
};

export function buildContactNotificationSubject(content: ContactNotificationContent): string {
  const mall = sanitizePlainText(content.mallName).trim() || 'AVM';
  const subject = sanitizePlainText(content.subject ?? '').trim();
  return subject ? `[${mall}] ${subject}` : `[${mall}] Yeni iletişim mesajı`;
}

export function buildContactNotificationText(content: ContactNotificationContent): string {
  const lines = [
    'Yeni bir iletişim formu mesajı alındı.',
    '',
    `AVM: ${sanitizePlainText(content.mallName).trim()}`,
    `Ad: ${sanitizePlainText(content.visitorName).trim()}`,
    `E-posta: ${sanitizePlainText(content.visitorEmail).trim()}`,
  ];
  const phone = sanitizePlainText(content.visitorPhone ?? '').trim();
  if (phone) lines.push(`Telefon: ${phone}`);
  const subject = sanitizePlainText(content.subject ?? '').trim();
  lines.push(`Konu: ${subject || '—'}`);
  lines.push('', 'Mesaj:', sanitizePlainText(content.message).trim(), '');
  return lines.join('\n');
}
