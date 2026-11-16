import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const REDIS_KEY = 'latest_discord_auth';
export const TTL_SECONDS = 900; // 15 minutes
