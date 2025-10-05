import Redis from 'ioredis';
import { ENV } from './env';

const redisUrl = ENV.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL is not defined in environment variables');
}

// Create a Redis client
const redis = new Redis(redisUrl);

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

export async function setJSON(key, value, ttl = 300) {
  const json = JSON.stringify(value);
  if (ttl > 0) {
    await redis.set(key, json, 'EX', ttl);
  } else {
    await redis.set(key, json);
  }
}

export async function getJSON(key) {
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function del(key) {
  await redis.del(key);
}

export default redis;