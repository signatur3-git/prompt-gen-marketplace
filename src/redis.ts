import { createClient } from 'redis';
import { config } from './config.js';

const redisClient = createClient({
  url: config.redis.url,
  password: config.redis.password || undefined,
});

redisClient.on('error', (err) => console.error('❌ Redis error:', err));
redisClient.on('connect', () => console.info('✅ Redis connected'));

export async function connectRedis() {
  await redisClient.connect();
}

export async function closeRedis() {
  await redisClient.quit();
  console.info('🔌 Redis connection closed');
}

export { redisClient };
