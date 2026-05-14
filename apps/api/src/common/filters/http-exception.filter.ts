import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_SERVER_ERROR';

const HTTP_STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const raw = exception.getResponse();

    let message: string;
    if (typeof raw === 'string') {
      message = raw;
    } else if (typeof raw === 'object' && raw !== null && 'message' in raw) {
      const m = (raw as { message: string | string[] }).message;
      message = Array.isArray(m) ? m.join('; ') : String(m);
    } else {
      message = exception.message;
    }

    const code: ErrorCode = HTTP_STATUS_TO_CODE[status] ?? 'INTERNAL_SERVER_ERROR';

    if (status >= 500) {
      const version = process.env.APP_VERSION ?? '0.0.0';
      const gitSha = process.env.APP_GIT_SHA ?? 'unknown';
      const tenantId = req.tenantId ?? req.header('x-tenant-id')?.trim();
      const mallId = req.mallId ?? req.header('x-mall-id')?.trim();
      const op = `${req.method} ${req.path}`;
      this.logger.error(
        `[service=api] [version=${version}] [gitSha=${gitSha}] [op=${op}] [tenantId=${tenantId ?? 'n/a'}] [mallId=${mallId ?? 'n/a'}] status=${status} code=${code} message=${message}`,
      );
    }

    res.status(status).json({
      success: false,
      error: { code, message },
    });
  }
}
