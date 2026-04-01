import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD;

// Build Redis URL with authentication if password exists
const redisUrl = redisPassword 
  ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
  : `redis://${redisHost}:${redisPort}`;

console.log('[REDIS CONFIG]', new Date().toISOString(), {
  host: redisHost,
  port: redisPort,
  hasPassword: !!redisPassword
});

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        console.error('[REDIS MAX RETRIES]', new Date().toISOString(), 'Max reconnection attempts exceeded');
        return new Error('Redis max retries reached');
      }
      const delay = retries * 50;
      console.log('[REDIS RECONNECT]', new Date().toISOString(), `Retry ${retries}, delay: ${delay}ms`);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  console.error('[REDIS ERROR]', new Date().toISOString(), err.message, err.code);
});

redisClient.on('ready', () => {
  console.log('[REDIS READY]', new Date().toISOString(), 'Redis connected & ready');
});

redisClient.on('end', () => {
  console.warn('[REDIS END]', new Date().toISOString(), 'Redis connection closed');
});

redisClient.on('connect', () => {
  console.log('[REDIS CONNECT]', new Date().toISOString(), 'Redis connection established');
});

redisClient.on('reconnecting', () => {
  console.warn('[REDIS RECONNECTING]', new Date().toISOString(), 'Attempting to reconnect to Redis');
});

redisClient.on('drain', () => {
  console.log('[REDIS DRAIN]', new Date().toISOString(), 'Redis buffer drained');
});

export default redisClient;