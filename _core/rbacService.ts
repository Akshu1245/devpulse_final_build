// @ts-nocheck
import { EventEmitter } from 'events';
import pino from 'pino';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { schema } from '../schema';

/**
 * RBAC Service - Role-Based Access Control
 * Manages roles, permissions, and access control policies
 */

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  organizationId: string;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  category: 'billing' | 'security' | 'compliance' | 'users' | 'analytics' | 'admin';
}

export interface UserRole {
  userId: string;
  roleId: string;
  organizationId: string;
  assignedAt: Date;
  assignedBy: string;
  assignmentContext?: Record<string, any>;
}

export interface RoleAssignment {
  userId: string;
  roles: Role[];
  permissions: Set<string>;
  organizationId: string;
}

export interface AccessDescision {
  allowed: boolean;
  reason?: string;
  deniedPermissions?: string[];
  appliedPolicies?: string[];
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  status: 'success' | 'failure' | 'denied';
}

/**
 * Built-in roles with predefined permissions
 */
const BUILTIN_ROLES = {
  ADMIN: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: [
      'billing:read', 'billing:write', 'billing:delete',
      'security:read', 'security:write', 'security:delete',
      'compliance:read', 'compliance:write', 'compliance:delete',
      'users:read', 'users:write', 'users:delete',
      'analytics:read', 'analytics:write',
      'admin:read', 'admin:write', 'admin:delete',
    ],
  },
  OWNER: {
    name: 'Organization Owner',
    description: 'Organization owner with full access',
    permissions: [
      'billing:read', 'billing:write',
      'security:read', 'security:write',
      'compliance:read', 'compliance:write',
      'users:read', 'users:write',
      'analytics:read', 'analytics:write',
      'admin:read', 'admin:write',
    ],
  },
  MANAGER: {
    name: 'Team Manager',
    description: 'Manage team members and projects',
    permissions: [
      'security:read', 'security:write',
      'compliance:read',
      'users:read', 'users:write',
      'analytics:read',
    ],
  },
  SECURITY_OFFICER: {
    name: 'Security Officer',
    description: 'Manage security policies and compliance',
    permissions: [
      'security:read', 'security:write',
      'compliance:read', 'compliance:write',
      'analytics:read',
      'billing:read',
    ],
  },
  ANALYST: {
    name: 'Security Analyst',
    description: 'View and analyze security data',
    permissions: [
      'security:read',
      'compliance:read',
      'analytics:read',
      'billing:read',
    ],
  },
  DEVELOPER: {
    name: 'Developer',
    description: 'Manage API keys and integrations',
    permissions: [
      'security:read',
      'analytics:read',
      'billing:read',
    ],
  },
  VIEWER: {
    name: 'Viewer',
    description: 'Read-only access to reports',
    permissions: [
      'analytics:read',
      'billing:read',
    ],
  },
};

/**
 * Permission categories and their descriptions
 */
const PERMISSION_CATALOG: Record<string, Permission> = {
  // Billing permissions
  'billing:read': {
    id: 'billing:read',
    name: 'View Billing',
    description: 'View billing information, invoices, and usage',
    resource: 'billing',
    action: 'read',
    category: 'billing',
  },
  'billing:write': {
    id: 'billing:write',
    name: 'Manage Billing',
    description: 'Create and manage subscriptions, payment methods',
    resource: 'billing',
    action: 'write',
    category: 'billing',
  },
  'billing:delete': {
    id: 'billing:delete',
    name: 'Delete Billing',
    description: 'Cancel subscriptions and remove payment methods',
    resource: 'billing',
    action: 'delete',
    category: 'billing',
  },

  // Security permissions
  'security:read': {
    id: 'security:read',
    name: 'View Security',
    description: 'View security scans and vulnerability reports',
    resource: 'security',
    action: 'read',
    category: 'security',
  },
  'security:write': {
    id: 'security:write',
    name: 'Manage Security',
    description: 'Create and manage security policies and scans',
    resource: 'security',
    action: 'write',
    category: 'security',
  },
  'security:delete': {
    id: 'security:delete',
    name: 'Delete Security',
    description: 'Delete security policies and scan results',
    resource: 'security',
    action: 'delete',
    category: 'security',
  },

  // Compliance permissions
  'compliance:read': {
    id: 'compliance:read',
    name: 'View Compliance',
    description: 'View compliance reports and audit logs',
    resource: 'compliance',
    action: 'read',
    category: 'compliance',
  },
  'compliance:write': {
    id: 'compliance:write',
    name: 'Manage Compliance',
    description: 'Manage compliance policies and generate reports',
    resource: 'compliance',
    action: 'write',
    category: 'compliance',
  },
  'compliance:delete': {
    id: 'compliance:delete',
    name: 'Delete Compliance',
    description: 'Delete compliance policies and purge audit data',
    resource: 'compliance',
    action: 'delete',
    category: 'compliance',
  },

  // User management permissions
  'users:read': {
    id: 'users:read',
    name: 'View Users',
    description: 'View team members and their roles',
    resource: 'users',
    action: 'read',
    category: 'users',
  },
  'users:write': {
    id: 'users:write',
    name: 'Manage Users',
    description: 'Add, modify, and assign roles to team members',
    resource: 'users',
    action: 'write',
    category: 'users',
  },
  'users:delete': {
    id: 'users:delete',
    name: 'Delete Users',
    description: 'Remove team members from organization',
    resource: 'users',
    action: 'delete',
    category: 'users',
  },

  // Analytics permissions
  'analytics:read': {
    id: 'analytics:read',
    name: 'View Analytics',
    description: 'View dashboards and reports',
    resource: 'analytics',
    action: 'read',
    category: 'analytics',
  },
  'analytics:write': {
    id: 'analytics:write',
    name: 'Manage Analytics',
    description: 'Create custom reports and dashboards',
    resource: 'analytics',
    action: 'write',
    category: 'analytics',
  },

  // Admin permissions
  'admin:read': {
    id: 'admin:read',
    name: 'View Admin',
    description: 'View administrative settings',
    resource: 'admin',
    action: 'read',
    category: 'admin',
  },
  'admin:write': {
    id: 'admin:write',
    name: 'Manage Admin',
    description: 'Modify administrative settings',
    resource: 'admin',
    action: 'write',
    category: 'admin',
  },
  'admin:delete': {
    id: 'admin:delete',
    name: 'Delete Admin',
    description: 'Delete administrative configurations',
    resource: 'admin',
    action: 'delete',
    category: 'admin',
  },
};

export class RBACService extends EventEmitter {
  private logger: pino.Logger;
  private roleCache: Map<string, Role> = new Map();
  private userRoleCache: Map<string, RoleAssignment> = new Map();

  constructor(logger: pino.Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Initialize built-in roles for organization
   */
  async initializeOrganizationRoles(organizationId: string): Promise<void> {
    try {
      const existingRoles = await db.query.rbacRoles.findMany({
        where: eq(schema.rbacRoles.organizationId, organizationId),
      });

      if (existingRoles.length > 0) {
        this.logger.info({ organizationId }, 'Roles already initialized');
        return;
      }

      // Create built-in roles
      for (const [roleKey, roleData] of Object.entries(BUILTIN_ROLES)) {
        await db.insert(schema.rbacRoles).values({
          id: `role_builtin_${roleKey.toLowerCase()}`,
          name: roleData.name,
          description: roleData.description,
          permissions: JSON.stringify(roleData.permissions),
          organizationId,
          isBuiltIn: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      this.logger.info({ organizationId }, '✅ Built-in roles initialized');
      this.emit('roles_initialized', { organizationId });
    } catch (error) {
      this.logger.error({ error, organizationId }, 'Failed to initialize roles');
      throw error;
    }
  }

  /**
   * Create custom role
   */
  async createRole(data: {
    organizationId: string;
    name: string;
    description: string;
    permissions: string[];
    createdBy: string;
  }): Promise<Role> {
    try {
      // Validate permissions exist
      for (const perm of data.permissions) {
        if (!PERMISSION_CATALOG[perm]) {
          throw new Error(`Invalid permission: ${perm}`);
        }
      }

      const roleId = `role_${Date.now()}`;
      const now = new Date();

      await db.insert(schema.rbacRoles).values({
        id: roleId,
        name: data.name,
        description: data.description,
        permissions: JSON.stringify(data.permissions),
        organizationId: data.organizationId,
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now,
      });

      const role: Role = {
        id: roleId,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        organizationId: data.organizationId,
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now,
      };

      this.logger.info(
        { roleId, organizationId: data.organizationId },
        '✅ Role created'
      );

      this.emit('role_created', role);
      return role;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to create role');
      throw error;
    }
  }

  /**
   * Update role permissions
   */
  async updateRole(data: {
    roleId: string;
    permissions: string[];
    updatedBy: string;
  }): Promise<Role> {
    try {
      // Validate permissions
      for (const perm of data.permissions) {
        if (!PERMISSION_CATALOG[perm]) {
          throw new Error(`Invalid permission: ${perm}`);
        }
      }

      const existing = await db.query.rbacRoles.findFirst({
        where: eq(schema.rbacRoles.id, data.roleId),
      });

      if (!existing) {
        throw new Error(`Role not found: ${data.roleId}`);
      }

      if (existing.isBuiltIn) {
        throw new Error('Cannot modify built-in roles');
      }

      const now = new Date();
      await db
        .update(schema.rbacRoles)
        .set({
          permissions: JSON.stringify(data.permissions),
          updatedAt: now,
        })
        .where(eq(schema.rbacRoles.id, data.roleId));

      const role: Role = {
        id: existing.id,
        name: existing.name,
        description: existing.description,
        permissions: data.permissions,
        organizationId: existing.organizationId,
        isBuiltIn: existing.isBuiltIn,
        createdAt: existing.createdAt,
        updatedAt: now,
      };

      this.logger.info({ roleId: data.roleId }, '✅ Role updated');
      this.emit('role_updated', role);

      // Clear cache
      this.roleCache.delete(data.roleId);
      this.userRoleCache.clear();

      return role;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to update role');
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(data: {
    userId: string;
    roleId: string;
    organizationId: string;
    assignedBy: string;
    context?: Record<string, any>;
  }): Promise<void> {
    try {
      // Verify role exists
      const role = await db.query.rbacRoles.findFirst({
        where: and(
          eq(schema.rbacRoles.id, data.roleId),
          eq(schema.rbacRoles.organizationId, data.organizationId)
        ),
      });

      if (!role) {
        throw new Error(`Role not found: ${data.roleId}`);
      }

      // Check if assignment already exists
      const existing = await db.query.rbacUserRoles.findFirst({
        where: and(
          eq(schema.rbacUserRoles.userId, data.userId),
          eq(schema.rbacUserRoles.roleId, data.roleId),
          eq(schema.rbacUserRoles.organizationId, data.organizationId)
        ),
      });

      if (existing) {
        this.logger.warn({ userId: data.userId, roleId: data.roleId }, 'Role already assigned');
        return;
      }

      // Assign role
      await db.insert(schema.rbacUserRoles).values({
        userId: data.userId,
        roleId: data.roleId,
        organizationId: data.organizationId,
        assignedAt: new Date(),
        assignedBy: data.assignedBy,
        assignmentContext: data.context ? JSON.stringify(data.context) : null,
      });

      this.logger.info({ userId: data.userId, roleId: data.roleId }, '✅ Role assigned to user');
      this.emit('role_assigned', {
        userId: data.userId,
        roleId: data.roleId,
        organizationId: data.organizationId,
      });

      // Clear cache
      this.userRoleCache.delete(`${data.userId}:${data.organizationId}`);
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to assign role');
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(data: {
    userId: string;
    roleId: string;
    organizationId: string;
    removedBy: string;
  }): Promise<void> {
    try {
      await db
        .delete(schema.rbacUserRoles)
        .where(
          and(
            eq(schema.rbacUserRoles.userId, data.userId),
            eq(schema.rbacUserRoles.roleId, data.roleId),
            eq(schema.rbacUserRoles.organizationId, data.organizationId)
          )
        );

      this.logger.info({ userId: data.userId, roleId: data.roleId }, '✅ Role removed from user');
      this.emit('role_removed', {
        userId: data.userId,
        roleId: data.roleId,
        organizationId: data.organizationId,
      });

      // Clear cache
      this.userRoleCache.delete(`${data.userId}:${data.organizationId}`);
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to remove role');
      throw error;
    }
  }

  /**
   * Get user's roles and permissions
   */
  async getUserRoleAssignment(data: {
    userId: string;
    organizationId: string;
  }): Promise<RoleAssignment> {
    const cacheKey = `${data.userId}:${data.organizationId}`;

    // Check cache
    if (this.userRoleCache.has(cacheKey)) {
      return this.userRoleCache.get(cacheKey)!;
    }

    try {
      // Get user's role assignments
      const assignments = await db.query.rbacUserRoles.findMany({
        where: and(
          eq(schema.rbacUserRoles.userId, data.userId),
          eq(schema.rbacUserRoles.organizationId, data.organizationId)
        ),
      });

      // Fetch role details
      const roleIds = assignments.map((a) => a.roleId);
      const roles = await db.query.rbacRoles.findMany({
        where: inArray(schema.rbacRoles.id, roleIds),
      });

      // Collect all permissions
      const permissionSet = new Set<string>();
      roles.forEach((role) => {
        const perms = JSON.parse(role.permissions || '[]') as string[];
        perms.forEach((p) => permissionSet.add(p));
      });

      const assignment: RoleAssignment = {
        userId: data.userId,
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: JSON.parse(r.permissions || '[]'),
          organizationId: r.organizationId,
          isBuiltIn: r.isBuiltIn,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        permissions: permissionSet,
        organizationId: data.organizationId,
      };

      // Cache result
      this.userRoleCache.set(cacheKey, assignment);

      return assignment;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to get user role assignment');
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(data: {
    userId: string;
    organizationId: string;
    permission: string;
  }): Promise<boolean> {
    try {
      const assignment = await this.getUserRoleAssignment({
        userId: data.userId,
        organizationId: data.organizationId,
      });

      return assignment.permissions.has(data.permission);
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to check permission');
      return false;
    }
  }

  /**
   * Verify access to resource
   */
  async verifyAccess(data: {
    userId: string;
    organizationId: string;
    resource: string;
    action: 'read' | 'write' | 'delete';
  }): Promise<AccessDescision> {
    try {
      const permission = `${data.resource}:${data.action}`;
      const hasAccess = await this.hasPermission({
        userId: data.userId,
        organizationId: data.organizationId,
        permission,
      });

      if (hasAccess) {
        return { allowed: true };
      }

      const assignment = await this.getUserRoleAssignment({
        userId: data.userId,
        organizationId: data.organizationId,
      });

      return {
        allowed: false,
        reason: 'Insufficient permissions',
        deniedPermissions: [permission],
        appliedPolicies: assignment.roles.map((r) => r.id),
      };
    } catch (error) {
      this.logger.error({ error, data }, 'Access verification failed');
      return {
        allowed: false,
        reason: 'Access verification error',
      };
    }
  }

  /**
   * Get all roles for organization
   */
  async getOrganizationRoles(organizationId: string): Promise<Role[]> {
    try {
      const roles = await db.query.rbacRoles.findMany({
        where: eq(schema.rbacRoles.organizationId, organizationId),
      });

      return roles.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: JSON.parse(r.permissions || '[]'),
        organizationId: r.organizationId,
        isBuiltIn: r.isBuiltIn,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (error) {
      this.logger.error({ error, organizationId }, 'Failed to get roles');
      throw error;
    }
  }

  /**
   * Get all permissions available
   */
  getAvailablePermissions(): Permission[] {
    return Object.values(PERMISSION_CATALOG);
  }

  /**
   * Get permissions by category
   */
  getPermissionsByCategory(category: string): Permission[] {
    return Object.values(PERMISSION_CATALOG).filter((p) => p.category === category);
  }

  /**
   * Get user roles in organization
   */
  async getUserRoles(data: {
    userId: string;
    organizationId: string;
  }): Promise<Role[]> {
    try {
      const assignment = await this.getUserRoleAssignment(data);
      return assignment.roles;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to get user roles');
      throw error;
    }
  }
}

export default RBACService;
