import type { CSSProperties } from 'react';
import {
  CONTENT_CHANNELS,
  CONTENT_CHANNEL_LABELS,
  type ContentChannel,
} from '../lib/content-channels';

type Props = {
  channels: ContentChannel[];
  onChange: (channels: ContentChannel[]) => void;
  labelStyle?: CSSProperties;
  disabled?: boolean;
};

export function ContentChannelFields({ channels, onChange, labelStyle, disabled }: Props) {
  const legendStyle = labelStyle ?? {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ ...legendStyle, padding: 0 }}>Kanallar</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {CONTENT_CHANNELS.map((ch) => {
          const checked = channels.includes(ch);
          return (
            <label
              key={ch}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: '#374151',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...channels, ch]
                    : channels.filter((c) => c !== ch);
                  onChange(next);
                }}
              />
              {CONTENT_CHANNEL_LABELS[ch]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
