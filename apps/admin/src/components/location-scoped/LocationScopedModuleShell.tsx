import type { ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth';
import { useMallRequired } from '../../hooks/useMallRequired';
import { MallRequiredStates } from '../MallRequiredStates';
import { PageContainer } from '../layout/PageContainer';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/Button';
import { LocationSelector } from './LocationSelector';

export type LocationScopedSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  noSelectionDescription?: string;
  meta?: ReactNode;
  headerAction?: ReactNode;
  search?: LocationScopedSearchProps;
  filters?: ReactNode;
  toolbarExtra?: ReactNode;
  children: ReactNode;
};

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  marginBottom: 16,
  padding: '12px 14px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#f9fafb',
};

const searchInputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '6px 8px',
  width: 220,
  borderRadius: 6,
  border: '1px solid #d1d5db',
  boxSizing: 'border-box',
};

export function LocationScopedModuleShell({
  title,
  subtitle,
  noSelectionDescription,
  meta,
  headerAction,
  search,
  filters,
  toolbarExtra,
  children,
}: Props) {
  const mallCtx = useMallRequired();
  const { malls, activeMallId } = useAuth();
  const activeMall = malls.find((m) => m.id === activeMallId);

  const resolvedSubtitle =
    subtitle ??
    (activeMall ? `${activeMall.name} — bu modül yalnızca seçili lokasyona özeldir.` : undefined);

  const defaultNoSelection =
    'Bu modül lokasyon kapsamlıdır; önce bir lokasyon seçin. Son seçiminiz otomatik hatırlanır.';

  return (
    <MallRequiredStates
      title={title}
      status={mallCtx}
      noSelectionDescription={noSelectionDescription ?? defaultNoSelection}
    >
      <PageContainer>
        <PageHeader title={title} subtitle={resolvedSubtitle} meta={meta} action={headerAction} />

        <div style={toolbarStyle}>
          <LocationSelector />
          {search ? (
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                {search.label ?? 'Ara'}
              </span>
              <input
                type="search"
                placeholder={search.placeholder ?? 'Ara…'}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                style={searchInputStyle}
              />
            </label>
          ) : null}
          {filters}
          {search ? (
            <Button variant="secondary" onClick={() => search.onChange('')}>
              Temizle
            </Button>
          ) : null}
          {toolbarExtra}
        </div>

        {mallCtx.status === 'ready' ? <div key={mallCtx.mallId}>{children}</div> : null}
      </PageContainer>
    </MallRequiredStates>
  );
}
