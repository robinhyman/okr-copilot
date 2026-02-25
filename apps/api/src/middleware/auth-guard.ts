import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

function safeEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export const requireMutatingAuth = (req: Request, res: Response, next: NextFunction): void => {
  const bearerToken = extractBearerToken(req);
  const apiKeyHeader = req.header('x-api-key')?.trim();
  const stubTokenHeader = req.header('x-auth-stub-token')?.trim();

  const guardToken = env.authGuardToken.trim();
  const stubToken = env.authStubToken.trim();

  if (guardToken) {
    const supplied = bearerToken ?? apiKeyHeader ?? '';
    if (!supplied || !safeEqual(guardToken, supplied)) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    next();
    return;
  }

  if (env.authStubEnabled && stubToken) {
    if (!stubTokenHeader || !safeEqual(stubToken, stubTokenHeader)) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
    next();
    return;
  }

  if (req.auth?.isAuthenticated) {
    next();
    return;
  }

  res.status(401).json({ ok: false, error: 'unauthorized' });
};
