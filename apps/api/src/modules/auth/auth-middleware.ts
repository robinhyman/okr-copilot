import { Request, Response, NextFunction } from 'express';
import { AuthProvider } from './auth-service.js';

declare global {
  namespace Express {
    interface Request {
      auth?: ReturnType<AuthProvider['getAuthStatus']>;
    }
  }
}

/**
 * TODO(auth): replace this middleware with token/session validation once real auth provider is integrated.
 */
export const authStubMiddleware = (authProvider: AuthProvider) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.auth = authProvider.getAuthStatus();
    next();
  };
};
