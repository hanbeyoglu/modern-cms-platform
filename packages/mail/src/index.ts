export {
  CONTACT_EMAIL_QUEUE_NAME,
  contactEmailJobId,
  type ContactEmailJobData,
} from './queue.js';
export {
  sanitizePlainText,
  buildContactNotificationSubject,
  buildContactNotificationText,
  type ContactNotificationContent,
} from './message.js';
export {
  resolveSmtpConfig,
  createSmtpTransport,
  sendContactNotificationEmail,
  type SmtpEnv,
  type SmtpConfig,
  type SendContactNotificationResult,
} from './smtp.js';
export { classifyMailError } from './errors.js';
export { contactEmailRfcMessageId, contactEmailDispatchId } from './message-id.js';
