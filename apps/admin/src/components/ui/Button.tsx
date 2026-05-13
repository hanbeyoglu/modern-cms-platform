import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
  },
  danger: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  ghost: {
    background: 'transparent',
    color: '#374151',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { fontSize: 11, padding: '3px 8px' },
  md: { fontSize: 13, padding: '6px 14px' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      style={{
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        borderRadius: 6,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.7 : 1,
        fontFamily: 'inherit',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  );
}
