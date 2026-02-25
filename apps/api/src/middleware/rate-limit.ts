import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const cleanup = (now: number): void => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

export const createRateLimiter = ({ windowMs, max, keyPrefix }: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanup(now);

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;

    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ ok: false, error: 'rate_limited', retryAfterSeconds });
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
};
