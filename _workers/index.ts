/**
 * DevPulse Background Workers
 * ============================
 * BullMQ worker entry point for async jobs
 */

import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV } from '../_core/env';
import { scanProcessor } from './processors/scanProcessor';
import { complianceProcessor } from './processors/complianceProcessor';
import { notificationProcessor } from './processors/notificationProcessor';

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
  maxRetriesPerRequest: null,
});

// Initialize workers
export const initWorkers = () => {
  console.log('[Workers] Initializing background job workers...');

  // Scan worker
  const scanWorker = new Worker('scans', scanProcessor, {
    connection: redis,
    concurrency: 3,
  });

  // Compliance worker
  const complianceWorker = new Worker('compliance', complianceProcessor, {
    connection: redis,
    concurrency: 2,
  });

  // Notification worker
  const notificationWorker = new Worker('notifications', notificationProcessor, {
    connection: redis,
    concurrency: 5,
  });

  // Error handling
  [scanWorker, complianceWorker, notificationWorker].forEach((worker) => {
    worker.on('failed', (job: any, err: any) => {
      console.error(`[Worker] Job ${job.id} failed:`, err.message);
    });
    worker.on('completed', (job: any) => {
      console.log(`[Worker] Job ${job.id} completed`);
    });
  });

  return { scanWorker, complianceWorker, notificationWorker };
};

export default initWorkers;
