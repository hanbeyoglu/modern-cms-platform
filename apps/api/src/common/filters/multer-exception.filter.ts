import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MulterExceptionFilter.name);

  catch(err: MulterError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    this.logger.debug(`Multer error [${err.code}]: ${err.message}`);

    let message: string;
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large. Maximum allowed size is 20 MB';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field — use field name "file"';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files in a single request';
        break;
      default:
        message = err.message;
    }

    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}
