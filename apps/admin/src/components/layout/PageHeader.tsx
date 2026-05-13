import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  meta?: ReactNode;
}

export function PageHeader({ title, subtitle, action, meta }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>{subtitle}</p>
        )}
        {meta && <div style={{ marginTop: 4 }}>{meta}</div>}
      </div>
      {action && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{action}</div>}
    </div>
  );
}
