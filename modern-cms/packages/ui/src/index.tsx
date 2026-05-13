import type { ReactNode } from 'react';

export type PlaceholderPanelProps = {
  title: string;
  children?: ReactNode;
};

export function PlaceholderPanel({ title, children }: PlaceholderPanelProps) {
  return (
    <section
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        background: '#fafafa',
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>{title}</h2>
      {children ?? <p style={{ margin: 0, color: '#6b7280' }}>UI paketi yer tutucu bileşeni.</p>}
    </section>
  );
}
