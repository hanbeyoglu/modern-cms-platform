/** Bare localhost permits HTTP(S) on any port; other entries remain exact origins. */
export function parseCorsOrigins(value: string): Array<string | RegExp> {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin === 'localhost' ? /^https?:\/\/localhost(?::\d+)?$/i : origin);
}
