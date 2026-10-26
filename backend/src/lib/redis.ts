import { createClient } from 'redis';
import { config } from '../config.js';

export const redis = createClient({ url: config.redisUrl, socket: {connectTimeout: 3000, reconnectStrategy: retries => retries > 2 ? false : 200} });
let redisReady = false;

redis.on('ready', () => { redisReady = true; });
redis.on('end', () => { redisReady = false; });
redis.on('error', (err) => {
  redisReady = false;
  console.warn('Redis unavailable:', err.message);
});

export async function connectRedis() {
  if (!redis.isOpen) {
    try { await redis.connect(); } catch { /* graceful fallback */ }
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisReady) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) as T : null;
  } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60) {
  if (!redisReady) return;
  try { await redis.setEx(key, ttlSeconds, JSON.stringify(value)); } catch { /* noop */ }
}

export async function cacheDel(pattern: string) {
  if (!redisReady) return;
  try {
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await redis.del(key);
    }
  } catch { /* noop */ }
}
