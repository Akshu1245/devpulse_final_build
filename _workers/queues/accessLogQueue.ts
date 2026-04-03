/**
 * Access Log Queue Worker
 * Background processor for HTTP access logs
 */

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { ENV } from '../../_core/env';

// Parse REDIS_URL for host and port
const redisUrl = ENV.REDIS_URL || 'redis://localhost:6379';
let redisHost = 'localhost';
let redisPort = 6379;

try {
  const url = new URL(redisUrl);
  redisHost = url.hostname || 'localhost';
  redisPort = parseInt(url.port || '6379', 10);
} catch {
  // Use defaults
}

const redis = new Redis({
  host: redisHost,
  port: redisPort,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err) => {
  console.warn('[AccessLogQueue] Redis unavailable:', err.message);
});

export const accessLogQueue = new Queue('access-logs', { connection: redis });

/**
 * Start processing access logs from queue
 */
export async function startAccessLogProcessor() {
  const worker = new Worker('access-logs', async (job) => {
    console.log(`[Access Log Worker] Processing job ${job.id}:`, job.data);
    // Process access log batch here
    // This would insert into http_access_log table
  }, { connection: redis });

  worker.on('completed', (job) => {
    console.log(`[Access Log Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Access Log Worker] Job ${job?.id} failed:`, err);
  });

  console.log('[Access Log Worker] Started');
  return worker;
}
