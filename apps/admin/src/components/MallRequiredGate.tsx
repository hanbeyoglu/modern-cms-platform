import type { ReactNode } from 'react';
import { PageContainer } from './layout/PageContainer';
import { PageHeader } from './layout/PageHeader';
import { EmptyState } from './ui/EmptyState';
import { LoadingState } from './ui/LoadingState';
import { useMallRequired } from '../hooks/useMallRequired';

type Props = {
  title: string;
  children: (ctx: { tenantId: string; mallId: string }) => ReactNode;
  noSelectionDescription?: string;
};

export function MallRequiredGate({ title, children, noSelectionDescription }: Props) {
  const mallCtx = useMallRequired();

  if (mallCtx.status === 'no-tenant') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <EmptyState title="Tenant seçilmedi" description="Üstten tenant seçin." />
      </PageContainer>
    );
  }

  if (mallCtx.status === 'loading') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <LoadingState label="AVM bilgileri yükleniyor…" />
      </PageContainer>
    );
  }

  if (mallCtx.status === 'no-malls') {
    return (
      <PageContainer>
        <PageHeader title={title} />
        <EmptyState title="AVM bulunamadı" description={mallCtx.message} />
      </PageContainer>
    );
  }

  if (mallCtx.status === 'no-selection') {
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

  return <>{children({ tenantId: mallCtx.tenantId, mallId: mallCtx.mallId })}</>;
}
