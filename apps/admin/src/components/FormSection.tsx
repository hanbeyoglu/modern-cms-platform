import type { CSSProperties, ReactNode } from 'react';

interface FormSectionProps {
  title: string;
  description?: ReactNode;
  /** Render as a closed-by-default <details> block (for rarely used settings). */
  collapsible?: boolean;
  children: ReactNode;
}

const wrapperStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '12px 16px 16px',
  margin: 0,
  background: '#fff',
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#111827',
  padding: '0 4px',
};

const descriptionStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 12,
  color: '#6b7280',
  lineHeight: 1.45,
};

const bodyStyle: CSSProperties = { display: 'grid', gap: 12 };

export function FormSection({ title, description, collapsible = false, children }: FormSectionProps) {
  if (collapsible) {
    return (
      <details style={wrapperStyle}>
        <summary style={{ ...titleStyle, cursor: 'pointer', padding: 0 }}>{title}</summary>
        <div style={{ marginTop: 12 }}>
          {description && <p style={descriptionStyle}>{description}</p>}
          <div style={bodyStyle}>{children}</div>
        </div>
      </details>
    );
  }
  return (
    <fieldset style={wrapperStyle}>
      <legend style={titleStyle}>{title}</legend>
      {description && <p style={descriptionStyle}>{description}</p>}
      <div style={bodyStyle}>{children}</div>
    </fieldset>
  );
}
