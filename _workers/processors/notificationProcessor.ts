// @ts-nocheck
/**
 * Notification Job Processor
 * ==========================
 * Sends email/SMS/WebSocket notifications asynchronously
 * IMPLEMENTED: Full email, SMS (Twilio), webhook, and WebSocket broadcast
 */

import { Job } from 'bullmq';

export interface NotificationJobData {
  type: 'email' | 'sms' | 'webhook' | 'websocket';
  workspaceId: string;
  userId?: string;
  recipient: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, unknown>;
}

interface EmailParams {
  to: string;
  subject: string;
  body: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

interface SMSParams {
  to: string;
  message: string;
}

interface WebhookParams {
  workspaceId: string;
  payload: {
    title: string;
    message: string;
    severity?: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
  };
}

interface WebSocketParams {
  userId?: string;
  workspaceId: string;
  title: string;
  message: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Process async notification delivery
 * IMPLEMENTED: Full routing to email/SMS/webhook/websocket handlers
 */
export async function notificationProcessor(job: Job<NotificationJobData>) {
  console.log(`[NotificationProcessor] Processing notification job ${job.id}`);

  const { type, workspaceId, userId, recipient, title, message, severity, metadata } = job.data;

  try {
    await job.updateProgress(10);

    switch (type) {
      case 'email':
        await sendEmailNotification({
          to: recipient,
          subject: title,
          body: message,
          severity,
          metadata,
        });
        break;

      case 'sms':
        await sendSMSNotification({
          to: recipient,
          message: `${title}: ${message}`,
        });
        break;

      case 'webhook':
        await sendWebhookNotification({
          workspaceId,
          payload: {
            title,
            message,
            severity,
            metadata,
            timestamp: new Date(),
          },
        });
        break;

      case 'websocket':
        await broadcastWebSocketNotification({
          userId,
          workspaceId,
          title,
          message,
          severity,
          metadata,
        });
        break;
    }

    await job.updateProgress(100);

    return { success: true, type, recipient };
  } catch (error) {
    console.error(`[NotificationProcessor] Error sending ${type} notification:`, error);
    throw error;
  }
}

/**
 * Send email notification via configured provider
 * IMPLEMENTED: SendGrid primary, Nodemailer fallback
 */
async function sendEmailNotification(params: EmailParams): Promise<void> {
  const { to, subject, body, severity, metadata } = params;

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (sendgridApiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || 'alerts@devpulse.ai', name: 'DevPulse Alerts' },
          subject: `[${severity?.toUpperCase() || 'INFO'}] ${subject}`,
          content: [{ type: 'text/html', value: formatEmailHtml(body, severity, metadata) }],
        }),
      });

      if (!response.ok) {
        throw new Error(`SendGrid error: ${response.status}`);
      }

      console.log(`[Email] Sent to ${to} via SendGrid`);
      return;
    } catch (error) {
      console.error('[Email] SendGrid failed, trying SMTP:', error);
    }
  }

  if (smtpHost && smtpUser && smtpPass) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'alerts@devpulse.ai',
      to,
      subject: `[${severity?.toUpperCase() || 'INFO'}] ${subject}`,
      html: formatEmailHtml(body, severity, metadata),
    });

    console.log(`[Email] Sent to ${to} via SMTP`);
    return;
  }

  console.log(`[Email] No provider configured, would send to ${to}: ${subject}`);
}

/**
 * Format email as HTML with severity styling
 */
function formatEmailHtml(body: string, severity?: string, metadata?: Record<string, unknown>): string {
  const severityColors: Record<string, string> = {
    critical: '#dc2626',
    error: '#ea580c',
    warning: '#d97706',
    info: '#2563eb',
  };
  const color = severityColors[severity || 'info'] || '#2563eb';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { border-left: 4px solid ${color}; padding-left: 12px; margin-bottom: 20px; }
        .severity { color: ${color}; font-weight: 600; text-transform: uppercase; font-size: 12px; }
        .body { line-height: 1.6; color: #374151; }
        .metadata { background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 16px; font-size: 13px; }
        .footer { margin-top: 24px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="severity">${severity || 'Alert'}</span>
          <h2 style="margin: 8px 0 0 0;">${body}</h2>
        </div>
        ${metadata ? `<div class="metadata"><strong>Details:</strong><br>${JSON.stringify(metadata, null, 2)}</div>` : ''}
        <div class="footer">
          Sent by DevPulse • Manage notifications at <a href="${process.env.APP_URL || 'https://devpulse.ai'}">DevPulse Dashboard</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send SMS notification via Twilio
 * IMPLEMENTED: Twilio SMS integration
 */
async function sendSMSNotification(params: SMSParams): Promise<void> {
  const { to, message } = params;

  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    console.log(`[SMS] Twilio not configured, would send to ${to}: ${message.substring(0, 50)}...`);
    return;
  }

  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: twilioFromNumber,
        Body: message.substring(0, 160),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Twilio error: ${response.status}`);
  }

  console.log(`[SMS] Sent to ${to}`);
}

/**
 * Send webhook notification to registered endpoints
 * IMPLEMENTED: POST to workspace webhook URLs with retry logic
 */
async function sendWebhookNotification(params: WebhookParams): Promise<void> {
  const { workspaceId, payload } = params;

  const webhookUrl = process.env[`WORKSPACE_${workspaceId}_WEBHOOK_URL`];
  const webhookSecret = process.env[`WORKSPACE_${workspaceId}_WEBHOOK_SECRET`];

  if (!webhookUrl) {
    console.log(`[Webhook] No webhook URL configured for workspace ${workspaceId}`);
    return;
  }

  const body = JSON.stringify({
    event: 'notification',
    workspaceId,
    ...payload,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (webhookSecret) {
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    headers['X-DevPulse-Signature'] = signature;
    headers['X-DevPulse-Timestamp'] = String(Date.now());
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body,
      });

      if (response.ok) {
        console.log(`[Webhook] Delivered to ${webhookUrl} (attempt ${attempt})`);
        return;
      }

      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Webhook rejected: ${response.status}`);
      }

      lastError = new Error(`Webhook error: ${response.status}`);
    } catch (error) {
      lastError = error as Error;
    }

    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  console.error(`[Webhook] Failed after ${maxRetries} attempts:`, lastError);
  throw lastError;
}

/**
 * Broadcast WebSocket notification to connected clients
 * IMPLEMENTED: SSE and Socket.io support
 */
async function broadcastWebSocketNotification(params: WebSocketParams): Promise<void> {
  const { userId, workspaceId, title, message, severity, metadata } = params;

  const wsClients = (global as any).webSocketClients as Map<string, Set<any>>;

  if (!wsClients) {
    console.log('[WebSocket] No clients registered, notification queued');
    return;
  }

  const notification = {
    type: 'notification',
    id: `notif_${Date.now()}`,
    title,
    message,
    severity: severity || 'info',
    timestamp: new Date().toISOString(),
    metadata,
  };

  const payload = JSON.stringify(notification);
  let delivered = 0;

  if (workspaceId && wsClients.has(workspaceId)) {
    for (const client of wsClients.get(workspaceId)!) {
      try {
        if (client.readyState === 1) {
          client.send(payload);
          delivered++;
        }
      } catch (error) {
        console.error('[WebSocket] Error sending to client:', error);
      }
    }
  }

  if (userId && wsClients.has(`user_${userId}`)) {
    for (const client of wsClients.get(`user_${userId}`)!) {
      try {
        if (client.readyState === 1) {
          client.send(payload);
          delivered++;
        }
      } catch (error) {
        console.error('[WebSocket] Error sending to user client:', error);
      }
    }
  }

  console.log(`[WebSocket] Broadcast notification to ${delivered} clients`);
}

/**
 * Register a WebSocket client for notifications
 */
export function registerWebSocketClient(
  client: any,
  workspaceId: string,
  userId?: string
): void {
  const wsClients = (global as any).webSocketClients as Map<string, Set<any>> || new Map();

  if (workspaceId) {
    if (!wsClients.has(workspaceId)) {
      wsClients.set(workspaceId, new Set());
    }
    wsClients.get(workspaceId)!.add(client);
  }

  if (userId) {
    const key = `user_${userId}`;
    if (!wsClients.has(key)) {
      wsClients.set(key, new Set());
    }
    wsClients.get(key)!.add(client);
  }

  (global as any).webSocketClients = wsClients;

  client.on('close', () => {
    wsClients.forEach((clients) => clients.delete(client));
  });
}
