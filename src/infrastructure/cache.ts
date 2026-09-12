import { Redis } from 'ioredis';
import { logger } from '../core/logger.js';
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  close(): Promise<void>;
}
export class MemoryCache implements Cache {
  private entries = new Map<string, { value: string; expires: number }>();
  constructor(private readonly maxEntries = 1000) {}
  async get<T>(key: string): Promise<T | null> {
    const item = this.entries.get(key);
    if (!item) return null;
    if (item.expires <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return JSON.parse(item.value) as T;
  }
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)
      throw new Error('TTL inválido');
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries)
      this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, {
      value: JSON.stringify(value),
      expires: Date.now() + ttlSeconds * 1000,
    });
  }
  async delete(key: string) {
    this.entries.delete(key);
  }
  async close() {
    this.entries.clear();
  }
}
class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  }
  async set<T>(key: string, value: T, ttlSeconds: number) {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
  async delete(key: string) {
    await this.redis.del(key);
  }
  async close() {
    this.redis.disconnect();
  }
}
export async function createCache(url?: string): Promise<Cache> {
  if (!url) return new MemoryCache();
  const redis = new Redis(url, {
    lazyConnect: true,
    keyPrefix: 'golazo:',
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: () => null,
  });
  redis.on('error', () => logger.warn('Redis indisponível'));
  try {
    await redis.connect();
    await redis.ping();
    return new RedisCache(redis);
  } catch (error) {
    redis.disconnect();
    throw error;
  }
}
