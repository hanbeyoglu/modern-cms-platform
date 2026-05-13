interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 6,
        marginBottom: 12,
        color: '#b91c1c',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#b91c1c',
            fontSize: 14,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
