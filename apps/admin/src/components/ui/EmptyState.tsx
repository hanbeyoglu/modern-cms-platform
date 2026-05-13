import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        border: '2px dashed #d1d5db',
        borderRadius: 8,
        color: '#6b7280',
      }}
    >
      <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#374151' }}>{title}</p>
      {description && <p style={{ margin: '0 0 16px', fontSize: 13 }}>{description}</p>}
      {action}
    </div>
  );
}
