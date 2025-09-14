import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';
import { LoggerService } from '../services/logger.service';

@injectable()
export class RequestLogger {
  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  log() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info('Request completed', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      });

      next();
    };
  }
}
