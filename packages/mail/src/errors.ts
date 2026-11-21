const SAFE_CODES = new Set([
  'smtp_not_configured',
  'smtp_network',
  'smtp_auth',
  'smtp_rejected',
  'smtp_transport',
  'smtp_error',
]);

/** Map transport failures to safe codes. Never return raw provider text (may contain addresses). */
export function classifyMailError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: unknown }).code ?? '');
    if (SAFE_CODES.has(code)) return code;
  }

  const message = err instanceof Error ? err.message : String(err);
  if (SAFE_CODES.has(message)) return message;
  if (/SMTP is not configured/i.test(message)) return 'smtp_not_configured';
  if (/ECONNREFUSED|ETIMEDOUT|ESOCKET|ENOTFOUND|ECONNRESET|EAI_AGAIN/i.test(message)) {
    return 'smtp_network';
  }
  if (/Invalid login|authentication|AUTH /i.test(message)) return 'smtp_auth';
  if (/\b(550|551|552|553|554)\b/i.test(message)) return 'smtp_rejected';
  if (/Message failed|Unexpected socket close|Greeting never received/i.test(message)) {
    return 'smtp_transport';
  }
  return 'smtp_error';
}
