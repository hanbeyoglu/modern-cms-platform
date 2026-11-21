import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import {
  buildContactNotificationSubject,
  buildContactNotificationText,
  type ContactNotificationContent,
} from './message.js';

export type SmtpEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
};

export type SendContactNotificationResult = {
  /** Nodemailer / SMTP accepted message id when available. */
  providerMessageId: string | null;
};

export function resolveSmtpConfig(env: SmtpEnv = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const secureRaw = env.SMTP_SECURE?.trim().toLowerCase();
  const port = Number(env.SMTP_PORT ?? (secureRaw === 'true' || secureRaw === '1' ? 465 : 587));
  if (!Number.isFinite(port) || port <= 0) return null;

  const secure =
    secureRaw === 'true' || secureRaw === '1' || (secureRaw == null && port === 465);

  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;

  return {
    host,
    port,
    secure,
    from,
    ...(user && pass != null && pass !== '' ? { auth: { user, pass } } : {}),
  };
}

export function createSmtpTransport(config: SmtpConfig) {
  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.auth ? { auth: config.auth } : {}),
  };
  return nodemailer.createTransport(options);
}

export async function sendContactNotificationEmail(params: {
  transport: ReturnType<typeof createSmtpTransport>;
  from: string;
  to: string;
  content: ContactNotificationContent;
  /** Deterministic RFC Message-ID for best-effort provider dedupe. */
  rfcMessageId: string;
}): Promise<SendContactNotificationResult> {
  const subject = buildContactNotificationSubject(params.content);
  const text = buildContactNotificationText(params.content);
  const info = await params.transport.sendMail({
    from: params.from,
    to: params.to,
    replyTo: params.content.visitorEmail,
    subject,
    text,
    messageId: params.rfcMessageId,
    headers: {
      'X-Entity-Ref-ID': params.rfcMessageId,
    },
  });
  const providerMessageId =
    typeof info.messageId === 'string' && info.messageId.trim() ? info.messageId.trim() : null;
  return { providerMessageId };
}
