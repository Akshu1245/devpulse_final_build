/**
 * Compliance Queue
 * ================
 * BullMQ queue for compliance report generation
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
  console.warn('[ComplianceQueue] Redis unavailable:', err.message);
});

export const complianceQueue = new Queue('compliance', { connection: redis });

export interface ComplianceJobOptions {
  workspaceId: string;
  scanId: string;
  complianceType: 'PCI_DSS' | 'GDPR' | 'SOC2';
  includeRemediation?: boolean;
}

export async function enqueueComplianceReport(options: ComplianceJobOptions) {
  const job = await complianceQueue.add('generate', options, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  });

  return job;
}
