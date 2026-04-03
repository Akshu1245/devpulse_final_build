// @ts-nocheck
/**
 * Scan Queue
 * ==========
 * BullMQ queue for security scans
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
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
  console.warn('[ScanQueue] Redis unavailable:', err.message);
});

export const scanQueue = new Queue('scans', { connection: redis });

export interface ScanJobOptions {
  workspaceId: string;
  projectId: string;
  apiEndpoint: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function enqueueScan(options: ScanJobOptions) {
  const job = await scanQueue.add('scan', options, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });

  return job;
}

export async function getScanStatus(jobId: string) {
  const job = await scanQueue.getJob(jobId);
  if (!job) return null;

  return {
    id: job.id,
    status: await job.getState(),
    progress: job.progress,
    isCompleted: job.isCompleted(),
    isFailed: job.isFailed(),
  };
}
