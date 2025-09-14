import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';
import { LoggerService } from '../services/logger.service';

@injectable()
export class ErrorHandler {
  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  handle() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      const statusCode = (error as any).statusCode || 500;
      const message = this.config.get('NODE_ENV') === 'production'
        ? 'Internal server error'
        : error.message;

      res.status(statusCode).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message,
          data: this.config.get('NODE_ENV') === 'development' ? error.stack : undefined
        },
        id: null
      });
    };
  }
}
