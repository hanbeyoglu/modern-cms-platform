import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'ghost';
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
  dangerSoft: {
    background: 'transparent',
    color: '#dc2626',
    border: '1px solid transparent',
  },
  ghost: {
    background: 'transparent',
    color: '#374151',
    border: '1px solid transparent',
  },
};

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { fontSize: 12, padding: '5px 10px', minHeight: 30 },
  md: { fontSize: 13, padding: '6px 14px', minHeight: 34 },
};

const VARIANT_CLASS: Partial<Record<Variant, string>> = {
  dangerSoft: 'cms-btn-danger-soft',
  ghost: 'cms-btn-ghost',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled,
    children,
    style,
    className,
    ...rest
  },
  ref,
) {
  const variantClass = VARIANT_CLASS[variant];
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={[variantClass, className].filter(Boolean).join(' ') || undefined}
      style={{
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        borderRadius: 6,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.7 : 1,
        fontFamily: 'inherit',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxSizing: 'border-box',
        ...style,
      }}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  );
});
