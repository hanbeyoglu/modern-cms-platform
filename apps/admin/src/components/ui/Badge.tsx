import type { ReactNode } from 'react';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'yellow' | 'red';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  gray:   { background: '#f3f4f6', color: '#374151' },
  blue:   { background: '#eff6ff', color: '#1d4ed8' },
  green:  { background: '#d1fae5', color: '#065f46' },
  yellow: { background: '#fef3c7', color: '#92400e' },
  red:    { background: '#fef2f2', color: '#b91c1c' },
};

export function Badge({ variant = 'gray', children }: BadgeProps) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 7px',
        borderRadius: 4,
        ...VARIANT_STYLES[variant],
      }}
    >
      {children}
    </span>
  );
}
