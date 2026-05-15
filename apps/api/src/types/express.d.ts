declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      mallId?: string;
      correlationId?: string;
      requestId?: string;
    }
  }
}

export {};
