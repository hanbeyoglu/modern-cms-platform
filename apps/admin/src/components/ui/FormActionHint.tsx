export function FormActionHint({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#b45309', lineHeight: 1.4 }}>{message}</p>
  );
}
