/**
 * Notification Service
 * ====================
 * Unified notification handling (email, SMS, webhooks)
 */

import { enqueueNotification, enqueueBulkNotifications } from '../_workers/queues/notificationQueue';

// Re-export queue functions
export { enqueueNotification, enqueueBulkNotifications };

export interface NotificationOptions {
  type: 'email' | 'sms' | 'webhook' | 'websocket';
  workspaceId: string;
  userId?: string;
  recipient: string;
  title: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface BulkNotificationOptions {
  type: 'email' | 'sms' | 'webhook' | 'websocket';
  workspaceId: string;
  title: string;
  message: string;
  recipients: Array<{
    userId?: string;
    email: string;
    preference?: 'email' | 'sms' | 'both';
  }>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, unknown>;
}

/**
 * Send urgent notification immediately
 */
export async function sendUrgentNotification(
  options: NotificationOptions
): Promise<{ id: string; queued: boolean }> {
  console.log(`[Notifications] Sending urgent ${options.type} notification`);

  const job = await enqueueNotification({
    type: options.type,
    workspaceId: options.workspaceId,
    userId: options.userId,
    recipient: options.recipient,
    title: options.title,
    message: options.message,
    severity: options.severity || 'error',
    metadata: options.metadata,
  });

  return {
    id: job.id?.toString() || 'unknown',
    queued: true,
  };
}

/**
 * Send routine notification (batched)
 */
export async function sendRoutineNotification(
  options: NotificationOptions
): Promise<{ id: string; queued: boolean }> {
  // Add to batch queue for processing later
  const job = await enqueueNotification({
    type: options.type,
    workspaceId: options.workspaceId,
    userId: options.userId,
    recipient: options.recipient,
    title: options.title,
    message: options.message,
    severity: options.severity || 'info',
    metadata: options.metadata,
  });

  return {
    id: job.id?.toString() || 'unknown',
    queued: true,
  };
}

/**
 * Send bulk notifications
 */
export async function sendBulkNotifications(
  options: BulkNotificationOptions
): Promise<{ count: number; queued: boolean }> {
  console.log(`[Notifications] Sending bulk notifications to ${options.recipients.length} recipients`);

  const notifications = options.recipients.map((recipient) => ({
    type: options.type,
    workspaceId: options.workspaceId,
    userId: recipient.userId,
    recipient: recipient.email,
    title: options.title,
    message: options.message,
    severity: options.severity || 'info',
    metadata: options.metadata,
  }));

  const jobs = await enqueueBulkNotifications(notifications);

  return {
    count: jobs.length,
    queued: true,
  };
}

/**
 * Send vulnerability alert
 */
export async function sendVulnerabilityAlert(
  workspaceId: string,
  scanId: string,
  vulnerabilities: any[],
  recipientEmail: string
): Promise<void> {
  const critical = vulnerabilities.filter((v) => v.severity === 'critical').length;
  const high = vulnerabilities.filter((v) => v.severity === 'high').length;

  await sendUrgentNotification({
    type: 'email',
    workspaceId,
    recipient: recipientEmail,
    title: `Security Scan Results: ${critical} Critical, ${high} High`,
    message: `Scan ${scanId} completed with findings.`,
    severity: critical > 0 ? 'critical' : 'warning',
    metadata: {
      scanId,
      vulnerabilityCount: vulnerabilities.length,
      critical,
      high,
    },
  });
}

/**
 * Send cost threshold alert
 */
export async function sendCostThresholdAlert(
  workspaceId: string,
  currentCost: number,
  threshold: number,
  recipientEmail: string
): Promise<void> {
  const percentage = ((currentCost / threshold) * 100).toFixed(1);

  await sendUrgentNotification({
    type: 'email',
    workspaceId,
    recipient: recipientEmail,
    title: `Cost Threshold Alert: ${percentage}% Used`,
    message: `Current spending: $${currentCost.toFixed(2)} of $${threshold.toFixed(2)}`,
    severity: percentage > '90' ? 'critical' : 'warning',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLACK BUDGET ALERT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export interface SlackBudgetAlertParams {
  workspaceId: number;
  agentId?: string;
  currentCostUsd: number;
  budgetLimitUsd: number;
  percentUsed: number;
  timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
  topExpensiveEndpoint?: string;
  projectedMonthlyUsd?: number;
}

/**
 * Send a Slack budget alert to configured webhook
 */
export async function sendSlackBudgetAlert(params: SlackBudgetAlertParams): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Notifications] Slack webhook URL not configured');
    return;
  }
  
  const { currentCostUsd, budgetLimitUsd, percentUsed, timeframe } = params;
  const isOver = percentUsed >= 100;
  const emoji = isOver ? ':rotating_light:' : percentUsed >= 90 ? ':warning:' : ':bar_chart:';
  const color = isOver ? '#DC2626' : percentUsed >= 80 ? '#D97706' : '#2563EB';
  
  const payload = {
    attachments: [{
      color,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} DevPulse Budget Alert`, emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Workspace:*\n${params.workspaceId}` },
            { type: 'mrkdwn', text: `*Timeframe:*\n${timeframe.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Current Cost:*\n$${currentCostUsd.toFixed(4)}` },
            { type: 'mrkdwn', text: `*Budget Limit:*\n$${budgetLimitUsd.toFixed(2)}` },
            { type: 'mrkdwn', text: `*Used:*\n${percentUsed.toFixed(1)}%` },
            { type: 'mrkdwn', text: `*Remaining:*\n$${Math.max(0, budgetLimitUsd - currentCostUsd).toFixed(4)}` },
          ]
        },
        params.topExpensiveEndpoint ? {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Top Cost Driver:* \`${params.topExpensiveEndpoint}\`` }
        } : null,
        params.projectedMonthlyUsd ? {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Projected Monthly Cost:* $${params.projectedMonthlyUsd.toFixed(2)}` }
        } : null,
        {
          type: 'actions',
          elements: [{
            type: 'button',
            text: { type: 'plain_text', text: 'View Dashboard' },
            url: `https://dashboard.devpulse.in/cost-analytics?workspace=${params.workspaceId}`,
            style: isOver ? 'danger' : 'primary',
          }]
        }
      ].filter(Boolean)
    }]
  };
  
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Slack returned ${res.status}`);
    console.log('[Notifications] Slack budget alert sent successfully');
  } catch (error) {
    console.error('[Notifications] Slack alert failed:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL BUDGET ALERT SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailBudgetAlertParams {
  recipientEmail: string;
  workspaceId: number;
  currentCostUsd: number;
  budgetLimitUsd: number;
  percentUsed: number;
  timeframe: string;
}

/**
 * Send an email budget alert
 */
export async function sendEmailBudgetAlert(params: EmailBudgetAlertParams): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[Notifications] SMTP not configured for email alerts');
    return;
  }
  
  const { createTransport } = await import('nodemailer');
  const transporter = createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: smtpUser, pass: smtpPass },
  });
  
  const isOver = params.percentUsed >= 100;
  const subject = isOver
    ? `ALERT: Budget exceeded on DevPulse workspace ${params.workspaceId}`
    : `Warning: ${params.percentUsed.toFixed(0)}% of ${params.timeframe} budget used`;
  
  const alertColor = isOver ? '#DC2626' : '#D97706';
  const alertBg = isOver ? '#FEF2F2' : '#FFFBEB';
  const alertBorder = isOver ? '#DC2626' : '#D97706';
  
  await transporter.sendMail({
    from: `DevPulse Alerts <noreply@devpulse.in>`,
    to: params.recipientEmail,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
          <h1 style="color: #1B2A4A; margin: 0 0 8px;">DevPulse Budget Alert</h1>
          <p style="color: #6B7280; margin: 0 0 24px;">${params.timeframe} budget report for workspace ${params.workspaceId}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background: #F8FAFC; padding: 16px; border-radius: 6px;">
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">CURRENT COST</div>
              <div style="font-size: 24px; font-weight: bold; color: #1B2A4A;">$${params.currentCostUsd.toFixed(4)}</div>
            </div>
            <div style="background: #F8FAFC; padding: 16px; border-radius: 6px;">
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">BUDGET LIMIT</div>
              <div style="font-size: 24px; font-weight: bold; color: #1B2A4A;">$${params.budgetLimitUsd.toFixed(2)}</div>
            </div>
          </div>
          <div style="background: ${alertBg}; border: 1px solid ${alertBorder}; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
            <strong style="color: ${alertColor};">${params.percentUsed.toFixed(1)}% of budget used</strong>
            ${isOver ? ' — Budget exceeded! Consider pausing agents.' : ' — Approaching limit. Review agent activity.'}
          </div>
          <a href="https://dashboard.devpulse.in/cost-analytics" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Full Dashboard</a>
        </div>
      </body>
      </html>
    `,
  });
  
  console.log(`[Notifications] Email budget alert sent to ${params.recipientEmail}`);
}
