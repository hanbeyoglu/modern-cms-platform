import { useState } from 'react';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function hashHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

type BrandAvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: number;
  variant?: 'rounded' | 'square';
};

export function BrandAvatar({
  name,
  imageUrl,
  size = 44,
  variant = 'rounded',
}: BrandAvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(imageUrl) && !failed;
  const radius = variant === 'square' ? 8 : Math.round(size * 0.28);
  const hue = hashHue(name);

  if (showImage) {
    return (
      <img
        src={imageUrl!}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: 'cover',
          flexShrink: 0,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          background: '#fff',
        }}
      />
    );
  }

  return (
    <InitialsFallback
      name={name}
      size={size}
      radius={radius}
      hue={hue}
    />
  );
}

function InitialsFallback({
  name,
  size,
  radius,
  hue,
}: {
  name: string;
  size: number;
  radius: number;
  hue: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, Math.round(size * 0.34)),
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: `hsl(${hue} 42% 28%)`,
        background: `hsl(${hue} 55% 92%)`,
        border: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      {getInitials(name)}
    </div>
  );
}
