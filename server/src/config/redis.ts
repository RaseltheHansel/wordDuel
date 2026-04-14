import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379' ),
    password: process.env.REDIS_PASSWORD || undefined,

    // Auto recnonnect if connection drops
    retryStrategy(times) {
        if(times > 3) {
            return null;
        }
        return Math.min(times * 200, 1000);
    },
    lazyConnect: true,

});

redis.on('connect', () => console.log('Connected to Redis'));
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('reconnecting', () => console.log('Reconnecting to Redis...'));