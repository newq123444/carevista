// backend/src/models/redis.ts — Redis-free in-memory stub
import { logger } from '../utils/logger';

const store = new Map<string, { value: string; expiresAt: number }>();

function isExpired(key: string): boolean {
  const item = store.get(key);
  if (!item) return true;
  if (item.expiresAt < Date.now()) { store.delete(key); return true; }
  return false;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (isExpired(key)) return null;
    const item = store.get(key)!;
    return JSON.parse(item.value) as T;
  },
  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    store.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  },
  async del(key: string): Promise<void> { store.delete(key); },
  async delPattern(pattern: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of store.keys()) { if (regex.test(key)) store.delete(key); }
  },
};

export const queue = {
  async push(queueName: string, job: object): Promise<void> {},
  async pop<T>(queueName: string): Promise<T | null> { return null; },
};

export async function testRedis(): Promise<void> {
  logger.info('Redis stub: skipping Redis — using in-memory cache');
}

const redis = { disconnect: () => {} };
export default redis as any;