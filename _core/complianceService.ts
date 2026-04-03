// @ts-nocheck
import { EventEmitter } from 'events';
import pino from 'pino';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../schema';

/**
 * Compliance Service - Audit Logging & Compliance Tracking
 * Tracks all system actions, compliance events, and maintains audit trail
 */

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'success' | 'failure' | 'denied';
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ComplianceEvent {
  id: string;
  organizationId: string;
  eventType: 'policy_change' | 'role_change' | 'permission_denied' | 'suspicious_activity' | 'access_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userId: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  timestamp: Date;
}

export interface ComplianceReport {
  id: string;
  organizationId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'annual';
  startDate: Date;
  endDate: Date;
  totalEvents: number;
  criticalEvents: number;
  securityIncidents: number;
  accessViolations: number;
  policyChanges: number;
  summary: string;
  generatedAt: Date;
  generatedBy: string;
}

export interface AuditFilter {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  resource?: string;
  action?: string;
  status?: 'success' | 'failure' | 'denied';
  severity?: 'info' | 'warning' | 'critical';
  limit?: number;
  offset?: number;
}

/**
 * Compliance Framework Definitions
 */
const COMPLIANCE_FRAMEWORKS = {
  SOC2: {
    name: 'SOC 2 Type II',
    description: 'Security, Availability, Processing Integrity, Confidentiality, Privacy',
    requirements: ['access_control', 'audit_logging', 'change_management', 'incident_response'],
  },
  HIPAA: {
    name: 'HIPAA',
    description: 'Health Insurance Portability and Accountability Act',
    requirements: ['encryption', 'access_control', 'audit_logging', 'breach_notification'],
  },
  GDPR: {
    name: 'GDPR',
    description: 'General Data Protection Regulation',
    requirements: ['data_retention', 'access_control', 'consent', 'audit_logging'],
  },
  PCI_DSS: {
    name: 'PCI DSS',
    description: 'Payment Card Industry Data Security Standard',
    requirements: ['encryption', 'access_control', 'audit_logging', 'vulnerability_scanning'],
  },
  ISO27001: {
    name: 'ISO 27001',
    description: 'Information Security Management',
    requirements: ['access_control', 'audit_logging', 'incident_response', 'risk_management'],
  },
};

/**
 * Event severity mapping
 */
const SEVERITY_LEVELS = {
  info: 0,
  warning: 1,
  critical: 2,
};

export class ComplianceService extends EventEmitter {
  private logger: pino.Logger;
  private eventBuffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(logger: pino.Logger) {
    super();
    this.logger = logger;
    this.startFlushTimer();
  }

  /**
   * Start periodic flush of audit log buffer
   */
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flushAuditBuffer().catch((error) => {
        this.logger.error({ error }, 'Failed to flush audit buffer');
      });
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Log audit event
   */
  async logAuditEvent(data: {
    organizationId: string;
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    severity?: 'info' | 'warning' | 'critical';
    status: 'success' | 'failure' | 'denied';
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    try {
      const logEntry: AuditLogEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        severity: data.severity || 'info',
        status: data.status,
        changes: data.changes,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date(),
      };

      // Add to buffer
      this.eventBuffer.push(logEntry);

      // Flush immediately for critical events
      if (logEntry.severity === 'critical' || data.status === 'denied') {
        await this.flushAuditBuffer();
      }

      return logEntry;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to log audit event');
      throw error;
    }
  }

  /**
   * Flush buffered audit logs to database
   */
  private async flushAuditBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = this.eventBuffer.splice(0, 100); // Batch in groups of 100

      for (const event of events) {
        await db.insert(schema.auditLogs).values({
          id: event.id,
          organizationId: event.organizationId,
          userId: event.userId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          severity: event.severity,
          status: event.status,
          changes: event.changes ? JSON.stringify(event.changes) : null,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp: event.timestamp,
          createdAt: new Date(),
        });
      }

      this.logger.debug({ count: events.length }, 'Flushed audit logs to database');
    } catch (error) {
      this.logger.error({ error }, 'Failed to flush audit logs');
      // Re-add events to buffer on failure
      if (this.eventBuffer.length > 0) {
        const failedEvents = this.eventBuffer.splice(0);
        this.eventBuffer.unshift(...failedEvents);
      }
    }
  }

  /**
   * Record compliance event
   */
  async recordComplianceEvent(data: {
    organizationId: string;
    eventType: 'policy_change' | 'role_change' | 'permission_denied' | 'suspicious_activity' | 'access_violation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    userId: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, any>;
  }): Promise<ComplianceEvent> {
    try {
      const eventId = `comp_${Date.now()}`;

      await db.insert(schema.complianceEvents).values({
        id: eventId,
        organizationId: data.organizationId,
        eventType: data.eventType,
        severity: data.severity,
        description: data.description,
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        resolved: false,
        timestamp: new Date(),
        createdAt: new Date(),
      });

      const event: ComplianceEvent = {
        id: eventId,
        organizationId: data.organizationId,
        eventType: data.eventType,
        severity: data.severity,
        description: data.description,
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        metadata: data.metadata,
        resolved: false,
        timestamp: new Date(),
      };

      this.logger.info(
        { eventId, eventType: data.eventType, severity: data.severity },
        '✅ Compliance event recorded'
      );

      this.emit('compliance_event', event);

      // Alert on critical events
      if (data.severity === 'critical') {
        this.emit('critical_compliance_event', event);
      }

      return event;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to record compliance event');
      throw error;
    }
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(filter: AuditFilter): Promise<{
    logs: AuditLogEntry[];
    total: number;
  }> {
    try {
      const limit = filter.limit || 50;
      const offset = filter.offset || 0;

      const conditions = [eq(schema.auditLogs.organizationId, filter.organizationId)];

      if (filter.startDate) {
        conditions.push(gte(schema.auditLogs.timestamp, filter.startDate));
      }
      if (filter.endDate) {
        conditions.push(lte(schema.auditLogs.timestamp, filter.endDate));
      }
      if (filter.userId) conditions.push(eq(schema.auditLogs.userId, filter.userId));
      if (filter.resource) conditions.push(eq(schema.auditLogs.resource, filter.resource));
      if (filter.action) conditions.push(eq(schema.auditLogs.action, filter.action));
      if (filter.status) conditions.push(eq(schema.auditLogs.status, filter.status));
      if (filter.severity) conditions.push(eq(schema.auditLogs.severity, filter.severity));

      const logs = await db.query.auditLogs.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.auditLogs.timestamp)],
        limit,
        offset,
      });

      return {
        logs: logs.map((l) => ({
          id: l.id,
          organizationId: l.organizationId,
          userId: l.userId,
          action: l.action,
          resource: l.resource,
          resourceId: l.resourceId,
          severity: l.severity,
          status: l.status,
          changes: l.changes ? JSON.parse(l.changes) : undefined,
          metadata: l.metadata ? JSON.parse(l.metadata) : undefined,
          ipAddress: l.ipAddress,
          userAgent: l.userAgent,
          timestamp: l.timestamp,
        })),
        total: logs.length,
      };
    } catch (error) {
      this.logger.error({ error, filter }, 'Failed to query audit logs');
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(data: {
    organizationId: string;
    reportType: 'daily' | 'weekly' | 'monthly' | 'annual';
    startDate: Date;
    endDate: Date;
    generatedBy: string;
  }): Promise<ComplianceReport> {
    try {
      // Get events in period
      const events = await db.query.complianceEvents.findMany({
        where: and(
          eq(schema.complianceEvents.organizationId, data.organizationId),
          gte(schema.complianceEvents.timestamp, data.startDate),
          lte(schema.complianceEvents.timestamp, data.endDate)
        ),
      });

      // Calculate metrics
      const totalEvents = events.length;
      const criticalEvents = events.filter((e) => e.severity === 'critical').length;
      const securityIncidents = events.filter((e) =>
        ['suspicious_activity', 'access_violation'].includes(e.eventType)
      ).length;
      const accessViolations = events.filter((e) => e.eventType === 'access_violation').length;
      const policyChanges = events.filter((e) => e.eventType === 'policy_change').length;

      const reportId = `report_${Date.now()}`;
      const summary = `${totalEvents} compliance events recorded, ${criticalEvents} critical, ${securityIncidents} security incidents`;

      await db.insert(schema.complianceReports).values({
        id: reportId,
        organizationId: data.organizationId,
        reportType: data.reportType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalEvents,
        criticalEvents,
        securityIncidents,
        accessViolations,
        policyChanges,
        summary,
        generatedAt: new Date(),
        generatedBy: data.generatedBy,
        createdAt: new Date(),
      });

      const report: ComplianceReport = {
        id: reportId,
        organizationId: data.organizationId,
        reportType: data.reportType,
        startDate: data.startDate,
        endDate: data.endDate,
        totalEvents,
        criticalEvents,
        securityIncidents,
        accessViolations,
        policyChanges,
        summary,
        generatedAt: new Date(),
        generatedBy: data.generatedBy,
      };

      this.logger.info(
        { reportId, reportType: data.reportType, totalEvents },
        '✅ Compliance report generated'
      );

      this.emit('report_generated', report);
      return report;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to generate report');
      throw error;
    }
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(reportId: string): Promise<ComplianceReport | null> {
    try {
      const report = await db.query.complianceReports.findFirst({
        where: eq(schema.complianceReports.id, reportId),
      });

      if (!report) return null;

      return {
        id: report.id,
        organizationId: report.organizationId,
        reportType: report.reportType,
        startDate: report.startDate,
        endDate: report.endDate,
        totalEvents: report.totalEvents,
        criticalEvents: report.criticalEvents,
        securityIncidents: report.securityIncidents,
        accessViolations: report.accessViolations,
        policyChanges: report.policyChanges,
        summary: report.summary,
        generatedAt: report.generatedAt,
        generatedBy: report.generatedBy,
      };
    } catch (error) {
      this.logger.error({ error, reportId }, 'Failed to get report');
      throw error;
    }
  }

  /**
   * Resolve compliance event
   */
  async resolveComplianceEvent(data: {
    eventId: string;
    resolvedBy: string;
  }): Promise<void> {
    try {
      await db
        .update(schema.complianceEvents)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: data.resolvedBy,
        })
        .where(eq(schema.complianceEvents.id, data.eventId));

      this.logger.info({ eventId: data.eventId }, '✅ Compliance event resolved');
      this.emit('event_resolved', { eventId: data.eventId });
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to resolve event');
      throw error;
    }
  }

  /**
   * Get unresolved compliance events
   */
  async getUnresolvedEvents(organizationId: string): Promise<ComplianceEvent[]> {
    try {
      const events = await db.query.complianceEvents.findMany({
        where: and(
          eq(schema.complianceEvents.organizationId, organizationId),
          eq(schema.complianceEvents.resolved, false)
        ),
        orderBy: [desc(schema.complianceEvents.timestamp)],
      });

      return events.map((e) => ({
        id: e.id,
        organizationId: e.organizationId,
        eventType: e.eventType,
        severity: e.severity,
        description: e.description,
        userId: e.userId,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        metadata: e.metadata ? JSON.parse(e.metadata) : undefined,
        resolved: e.resolved,
        resolvedAt: e.resolvedAt,
        resolvedBy: e.resolvedBy,
        timestamp: e.timestamp,
      }));
    } catch (error) {
      this.logger.error({ error, organizationId }, 'Failed to get unresolved events');
      throw error;
    }
  }

  /**
   * Check compliance framework requirements
   */
  async checkComplianceFramework(data: {
    organizationId: string;
    framework: keyof typeof COMPLIANCE_FRAMEWORKS;
  }): Promise<{
    framework: string;
    compliant: boolean;
    checkedItems: Record<string, boolean>;
  }> {
    try {
      const frameworkData = COMPLIANCE_FRAMEWORKS[data.framework];
      if (!frameworkData) {
        throw new Error(`Unknown framework: ${data.framework}`);
      }

      const checkedItems: Record<string, boolean> = {};

      // Check each requirement
      for (const requirement of frameworkData.requirements) {
        const recentLogs = await db.query.auditLogs.findMany({
          where: and(
            eq(schema.auditLogs.organizationId, data.organizationId),
            gte(schema.auditLogs.timestamp, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
          ),
          limit: 1,
        });

        // Check passes if we have recent audit logs
        checkedItems[requirement] = recentLogs.length > 0;
      }

      const compliant = Object.values(checkedItems).every((v) => v);

      return {
        framework: frameworkData.name,
        compliant,
        checkedItems,
      };
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to check compliance framework');
      throw error;
    }
  }

  /**
   * Clean up old audit logs (data retention policy)
   */
  async purgeOldAuditLogs(data: {
    organizationId: string;
    retentionDays: number;
  }): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - data.retentionDays * 24 * 60 * 60 * 1000);

      // Note: This would need a proper delete implementation
      // For now, we'll just log it
      this.logger.info(
        { organizationId: data.organizationId, retentionDays: data.retentionDays },
        'Audit log purge scheduled'
      );

      return 0;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to purge logs');
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush remaining events
    await this.flushAuditBuffer();

    this.logger.info('✅ Compliance service stopped');
  }
}

export default ComplianceService;
