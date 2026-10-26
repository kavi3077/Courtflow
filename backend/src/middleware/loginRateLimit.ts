import type { NextFunction, Request, Response } from 'express';
import { redis } from '../lib/redis.js';

export async function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  if (!redis.isReady) return next();
  try {
    const key = `login:${req.ip || 'unknown'}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, 60);
    if (attempts > 12) return res.status(429).json({ message: 'Too many login attempts. Try again shortly.' });
  } catch { /* graceful */ }
  next();
}
