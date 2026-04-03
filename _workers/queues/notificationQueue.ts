/**
 * Notification Queue
 * ==================
 * BullMQ queue for async notifications
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
  console.warn('[NotificationQueue] Redis unavailable:', err.message);
});

export const notificationQueue = new Queue('notifications', { connection: redis });

export interface NotificationJobOptions {
  type: 'email' | 'sms' | 'webhook' | 'websocket';
  workspaceId: string;
  userId?: string;
  recipient: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, unknown>;
}

export async function enqueueNotification(options: NotificationJobOptions) {
  const job = await notificationQueue.add('notify', options, {
    attempts: 3,
    backoff: {
      type: 'linear',
      delay: 1000,
    },
    removeOnComplete: true,
  });

  return job;
}

export async function enqueueBulkNotifications(notifications: NotificationJobOptions[]) {
  const jobs = await notificationQueue.addBulk(
    notifications.map((notification) => ({
      name: 'notify',
      data: notification,
    }))
  );

  return jobs;
}
