export const CONTACT_EMAIL_QUEUE_NAME = 'contact-email-notification';

export type ContactEmailJobData = {
  messageId: string;
  tenantId: string;
  mallId: string;
};

export function contactEmailJobId(messageId: string): string {
  return messageId;
}
