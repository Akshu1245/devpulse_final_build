// @ts-nocheck
import { t } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { schema } from '../schema';
import pino from 'pino';

const logger = pino();

/**
 * PHASE 12 - Compliance & Security Router
 * RBAC management, audit logging, compliance reporting
 */

// Validation schemas
const RoleInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

const AuditFilterInput = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  userId: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  status: z.enum(['success', 'failure', 'denied']).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0),
});

const ComplianceReportInput = z.object({
  reportType: z.enum(['daily', 'weekly', 'monthly', 'annual']),
  startDate: z.date(),
  endDate: z.date(),
});

export const complianceRouter = t.router({
  // ===================================================
  // RBAC ROLE MANAGEMENT
  // ===================================================

  /**
   * List all available roles for organization
   */
  getRoles: t.protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const roles = await global.rbacService.getOrganizationRoles(ctx.user.organizationId);
        return roles;
      } catch (error) {
        logger.error({ error }, 'Failed to get roles');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch roles',
        });
      }
    }),

  /**
   * Get all available permissions
   */
  getPermissions: t.protectedProcedure
    .query(async () => {
      try {
        const permissions = global.rbacService.getAvailablePermissions();
        return permissions.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
        }));
      } catch (error) {
        logger.error({ error }, 'Failed to get permissions');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch permissions',
        });
      }
    }),

  /**
   * Create custom role
   */
  createRole: t.protectedProcedure
    .input(RoleInput)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if user is admin
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'admin:write',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to create role',
          });
        }

        const role = await global.rbacService.createRole({
          organizationId: ctx.user.organizationId,
          name: input.name,
          description: input.description || '',
          permissions: input.permissions,
          createdBy: ctx.user.id,
        });

        // Log action
        await global.complianceService.logAuditEvent({
          organizationId: ctx.user.organizationId,
          userId: ctx.user.id,
          action: 'create_role',
          resource: 'rbac_roles',
          resourceId: role.id,
          severity: 'warning',
          status: 'success',
          metadata: { roleName: role.name },
          ipAddress: ctx.ipAddress,
        });

        return role;
      } catch (error) {
        logger.error({ error }, 'Failed to create role');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create role',
        });
      }
    }),

  /**
   * Update role permissions
   */
  updateRole: t.protectedProcedure
    .input(
      z.object({
        roleId: z.string(),
        permissions: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'admin:write',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const role = await global.rbacService.updateRole({
          roleId: input.roleId,
          permissions: input.permissions,
          updatedBy: ctx.user.id,
        });

        await global.complianceService.logAuditEvent({
          organizationId: ctx.user.organizationId,
          userId: ctx.user.id,
          action: 'update_role',
          resource: 'rbac_roles',
          resourceId: role.id,
          severity: 'warning',
          status: 'success',
          changes: {
            permissions: input.permissions,
          },
          ipAddress: ctx.ipAddress,
        });

        // Record compliance event
        await global.complianceService.recordComplianceEvent({
          organizationId: ctx.user.organizationId,
          eventType: 'policy_change',
          severity: 'medium',
          description: `Role ${role.name} permissions updated`,
          userId: ctx.user.id,
          resourceType: 'role',
          resourceId: role.id,
        });

        return role;
      } catch (error) {
        logger.error({ error }, 'Failed to update role');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update role',
        });
      }
    }),

  /**
   * Assign role to user
   */
  assignRoleToUser: t.protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        roleId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'users:write',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        await global.rbacService.assignRoleToUser({
          userId: input.userId,
          roleId: input.roleId,
          organizationId: ctx.user.organizationId,
          assignedBy: ctx.user.id,
        });

        await global.complianceService.logAuditEvent({
          organizationId: ctx.user.organizationId,
          userId: ctx.user.id,
          action: 'assign_role',
          resource: 'rbac_user_roles',
          resourceId: input.roleId,
          severity: 'warning',
          status: 'success',
          metadata: { targetUserId: input.userId },
          ipAddress: ctx.ipAddress,
        });

        // Record compliance event
        await global.complianceService.recordComplianceEvent({
          organizationId: ctx.user.organizationId,
          eventType: 'role_change',
          severity: 'medium',
          description: `Role assigned to user`,
          userId: ctx.user.id,
          resourceType: 'user',
          resourceId: input.userId,
          metadata: { roleId: input.roleId },
        });

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Failed to assign role');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to assign role',
        });
      }
    }),

  /**
   * Get user's roles and permissions
   */
  getUserRoles: t.protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'users:read',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const roles = await global.rbacService.getUserRoles({
          userId: input.userId,
          organizationId: ctx.user.organizationId,
        });

        return roles;
      } catch (error) {
        logger.error({ error }, 'Failed to get user roles');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user roles',
        });
      }
    }),

  // ===================================================
  // AUDIT LOGGING
  // ===================================================

  /**
   * Query audit logs with filters
   */
  getAuditLogs: t.protectedProcedure
    .input(AuditFilterInput)
    .query(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'admin:read',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const result = await global.complianceService.queryAuditLogs({
          organizationId: ctx.user.organizationId,
          startDate: input.startDate,
          endDate: input.endDate,
          userId: input.userId,
          resource: input.resource,
          action: input.action,
          status: input.status,
          severity: input.severity,
          limit: input.limit,
          offset: input.offset,
        });

        return {
          logs: result.logs.map((l) => ({
            id: l.id,
            action: l.action,
            resource: l.resource,
            status: l.status,
            severity: l.severity,
            timestamp: l.timestamp,
            userId: l.userId,
            ipAddress: l.ipAddress,
            metadata: l.metadata,
          })),
          total: result.total,
        };
      } catch (error) {
        logger.error({ error }, 'Failed to query audit logs');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch audit logs',
        });
      }
    }),

  /**
   * Get audit log details
   */
  getAuditLogDetail: t.protectedProcedure
    .input(z.object({ logId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'admin:read',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const log = await db.query.auditLogs.findFirst({
          where: eq(schema.auditLogs.id, input.logId),
        });

        if (!log || log.organizationId !== ctx.user.organizationId) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Audit log not found',
          });
        }

        return {
          id: log.id,
          action: log.action,
          resource: log.resource,
          status: log.status,
          severity: log.severity,
          changes: log.changes ? JSON.parse(log.changes) : null,
          metadata: log.metadata ? JSON.parse(log.metadata) : null,
          timestamp: log.timestamp,
          userId: log.userId,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        };
      } catch (error) {
        logger.error({ error }, 'Failed to get audit log detail');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch audit log',
        });
      }
    }),

  // ===================================================
  // COMPLIANCE MANAGEMENT
  // ===================================================

  /**
   * Get unresolved compliance events
   */
  getUnresolvedEvents: t.protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'compliance:read',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const events = await global.complianceService.getUnresolvedEvents(ctx.user.organizationId);

        return events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          severity: e.severity,
          description: e.description,
          timestamp: e.timestamp,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
        }));
      } catch (error) {
        logger.error({ error }, 'Failed to get compliance events');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch compliance events',
        });
      }
    }),

  /**
   * Resolve compliance event
   */
  resolveComplianceEvent: t.protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'compliance:write',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        await global.complianceService.resolveComplianceEvent({
          eventId: input.eventId,
          resolvedBy: ctx.user.id,
        });

        await global.complianceService.logAuditEvent({
          organizationId: ctx.user.organizationId,
          userId: ctx.user.id,
          action: 'resolve_compliance_event',
          resource: 'compliance_events',
          resourceId: input.eventId,
          status: 'success',
          ipAddress: ctx.ipAddress,
        });

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Failed to resolve event');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resolve event',
        });
      }
    }),

  // ===================================================
  // COMPLIANCE REPORTS
  // ===================================================

  /**
   * Generate compliance report
   */
  generateComplianceReport: t.protectedProcedure
    .input(ComplianceReportInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'compliance:write',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const report = await global.complianceService.generateComplianceReport({
          organizationId: ctx.user.organizationId,
          reportType: input.reportType,
          startDate: input.startDate,
          endDate: input.endDate,
          generatedBy: ctx.user.id,
        });

        await global.complianceService.logAuditEvent({
          organizationId: ctx.user.organizationId,
          userId: ctx.user.id,
          action: 'generate_report',
          resource: 'compliance_reports',
          resourceId: report.id,
          status: 'success',
          metadata: {
            reportType: input.reportType,
            totalEvents: report.totalEvents,
          },
          ipAddress: ctx.ipAddress,
        });

        return {
          id: report.id,
          reportType: report.reportType,
          totalEvents: report.totalEvents,
          criticalEvents: report.criticalEvents,
          securityIncidents: report.securityIncidents,
          summary: report.summary,
          generatedAt: report.generatedAt,
        };
      } catch (error) {
        logger.error({ error }, 'Failed to generate report');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate report',
        });
      }
    }),

  /**
   * Get compliance report
   */
  getComplianceReport: t.protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'compliance:read',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const report = await global.complianceService.getComplianceReport(input.reportId);

        if (!report || report.organizationId !== ctx.user.organizationId) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Report not found',
          });
        }

        return {
          id: report.id,
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
        };
      } catch (error) {
        logger.error({ error }, 'Failed to get report');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch report',
        });
      }
    }),

  /**
   * Check compliance framework status
   */
  checkComplianceFramework: t.protectedProcedure
    .input(
      z.object({
        framework: z.enum(['SOC2', 'HIPAA', 'GDPR', 'PCI_DSS', 'ISO27001']),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const hasPermission = await global.rbacService.hasPermission({
          userId: ctx.user.id,
          organizationId: ctx.user.organizationId,
          permission: 'compliance:read',
        });

        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
        }

        const result = await global.complianceService.checkComplianceFramework({
          organizationId: ctx.user.organizationId,
          framework: input.framework,
        });

        return result;
      } catch (error) {
        logger.error({ error }, 'Failed to check compliance framework');
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check compliance',
        });
      }
    }),
});

export type ComplianceRouter = typeof complianceRouter;
