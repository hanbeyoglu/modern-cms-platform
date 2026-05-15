export type ContentChannel = 'WEB' | 'MOBILE' | 'KIOSK' | 'SIGNAGE';

export const CONTENT_CHANNELS: ContentChannel[] = ['WEB', 'MOBILE', 'KIOSK', 'SIGNAGE'];

export const CONTENT_CHANNEL_LABELS: Record<ContentChannel, string> = {
  WEB: 'Web',
  MOBILE: 'Mobil',
  KIOSK: 'Kiosk',
  SIGNAGE: 'Dijital tabela',
};

/** Backend default when channels omitted on create. */
export const DEFAULT_CONTENT_CHANNELS: ContentChannel[] = ['WEB', 'MOBILE'];

export function formatChannels(channels: ContentChannel[] | undefined | null): string {
  if (!channels?.length) return '—';
  return channels.map((c) => CONTENT_CHANNEL_LABELS[c]).join(', ');
}

export function toggleChannel(
  channels: ContentChannel[],
  channel: ContentChannel,
  checked: boolean,
): ContentChannel[] {
  if (checked) {
    return channels.includes(channel) ? channels : [...channels, channel];
  }
  return channels.filter((c) => c !== channel);
}
