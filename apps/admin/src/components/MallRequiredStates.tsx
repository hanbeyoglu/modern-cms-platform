import type { ReactNode } from 'react';
import { PageContainer } from './layout/PageContainer';
import { PageHeader } from './layout/PageHeader';
import { EmptyState } from './ui/EmptyState';
import { LoadingState } from './ui/LoadingState';
import type { MallRequiredStatus } from '../hooks/useMallRequired';

type Props = {
  title: string;
  status: MallRequiredStatus;
  noSelectionDescription?: string;
  children: ReactNode;
};

export function MallRequiredStates({
  title,
  status,
  noSelectionDescription,
  children,
}: Props) {
  if (status.status === 'no-tenant') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <EmptyState title="Tenant seçilmedi" description="Üstten tenant seçin." />
      </PageContainer>
    );
  }

  if (status.status === 'loading') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <LoadingState label="AVM bilgileri yükleniyor…" />
      </PageContainer>
    );
  }

  if (status.status === 'no-malls') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <EmptyState title="AVM bulunamadı" description={status.message} />
      </PageContainer>
    );
  }

  if (status.status === 'no-selection') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <EmptyState
          title="AVM seçilmedi"
          description={
            noSelectionDescription ?? 'Bu sayfa AVM kapsamlıdır; üstten bir AVM seçin.'
          }
        />
      </PageContainer>
    );
  }

  return <>{children}</>;
}
