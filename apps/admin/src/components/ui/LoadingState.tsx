interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Yükleniyor…' }: LoadingStateProps) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
      {label}
    </div>
  );
}
