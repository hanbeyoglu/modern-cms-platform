import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuditEnabled } from '../lib/feature-flags';

export function AuditFeatureGate({ children }: { children: ReactNode }) {
  if (!isAuditEnabled()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
