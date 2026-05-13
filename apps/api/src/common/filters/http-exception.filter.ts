import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

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
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
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

    res.status(status).json({
      success: false,
      error: { code, message },
    });
  }
}
