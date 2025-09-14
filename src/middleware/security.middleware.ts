import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';
import { LoggerService } from '../services/logger.service';
import { SecurityService } from '../services/security.service';
import { SecurityContext } from '../types/mcp';

declare global {
  namespace Express {
    interface Request {
      securityContext?: SecurityContext;
    }
  }
}

@injectable()
export class SecurityMiddleware {
  constructor(
    @inject('ConfigService') private config: ConfigService,
    @inject('LoggerService') private logger: LoggerService,
    @inject('SecurityService') private securityService: SecurityService
  ) {}

  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          // Allow anonymous access for now
          return next();
        }

        if (!this.securityService.validateToken(authHeader)) {
          return res.status(401).json({
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Invalid authentication token'
            },
            id: null
          });
        }

        // Mock user authentication
        const user = await this.securityService.authenticate(authHeader);
        if (user) {
          req.securityContext = this.securityService.createSecurityContext(user, req);
        }

        next();
      } catch (error) {
        this.logger.error('Authentication error', { error });
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Authentication failed'
          },
          id: null
        });
      }
    };
  }

  authorize(requiredPermissions: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.securityContext) {
        // Allow anonymous access for now
        return next();
      }

      const authorized = await this.securityService.authorize(
        { id: req.securityContext.userId, username: '', roles: req.securityContext.roles, permissions: req.securityContext.permissions },
        requiredPermissions
      );

      if (!authorized) {
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'Insufficient permissions'
          },
          id: null
        });
      }

      next();
    };
  }
}
