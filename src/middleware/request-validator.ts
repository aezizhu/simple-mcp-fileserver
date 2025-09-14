import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';
import { LoggerService } from '../services/logger.service';
import Joi from 'joi';

@injectable()
export class RequestValidator {
  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  validateRequest(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error } = schema.validate(req.body);
      if (error) {
        this.logger.warn('Request validation failed', {
          error: error.details[0].message,
          path: req.path
        });
        return res.status(400).json({
          error: {
            code: -32602,
            message: 'Invalid request parameters',
            data: error.details[0].message
          }
        });
      }
      next();
    };
  }

  validateParams(params: any, schema: Joi.ObjectSchema): boolean {
    const { error } = schema.validate(params);
    return !error;
  }
}
