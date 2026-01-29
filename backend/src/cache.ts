import { createClient, type RedisClientType } from 'redis';
import { config } from './config.js';

type CacheEntry = {
  value: string;
  expiresAt: number | null;
};

const CACHE_PREFIX = 'hotstocks:';
const memoryCache = new Map<string, CacheEntry>();

let redisClient: RedisClientType | null = null;
let redisReady = false;
let redisDisabled = false;
let redisConnectPromise: Promise<void> | null = null;

function getPrefixedKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlMs?: number): void {
  const expiresAt = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null;
  memoryCache.set(key, { value, expiresAt });
}

async function getRedisClient(): Promise<RedisClientType | null> {
  if (!config.redisUrl || redisDisabled) return null;

  if (!redisClient) {
    redisClient = createClient({ url: config.redisUrl });
    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  if (!redisReady) {
    if (!redisConnectPromise) {
      redisConnectPromise = redisClient.connect().then(() => {
        redisReady = true;
      }).catch((err) => {
        console.error('Failed to connect to Redis, falling back to memory cache:', err);
        redisDisabled = true;
      });
    }

    await redisConnectPromise;
  }

  return redisReady ? redisClient : null;
}

export async function cacheGet(key: string): Promise<string | null> {
  const prefixedKey = getPrefixedKey(key);

  const redis = await getRedisClient();
  if (redis) {
    try {
      const value = await redis.get(prefixedKey);
      if (value !== null) return value;
    } catch (err) {
      console.error('Redis get failed, falling back to memory cache:', err);
    }
  }

  return memoryGet(prefixedKey);
}

export async function cacheSet(key: string, value: string, ttlMs?: number): Promise<void> {
  const prefixedKey = getPrefixedKey(key);

  const redis = await getRedisClient();
  if (redis) {
    try {
      if (ttlMs && ttlMs > 0) {
        await redis.set(prefixedKey, value, { PX: ttlMs });
      } else {
        await redis.set(prefixedKey, value);
      }
    } catch (err) {
      console.error('Redis set failed, falling back to memory cache:', err);
    }
  }

  memorySet(prefixedKey, value, ttlMs);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const value = await cacheGet(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch (err) {
    console.error('Failed to parse cached JSON value:', err);
    return null;
  }
}

export async function cacheSetJson<T>(key: string, value: T, ttlMs?: number): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlMs);
}
