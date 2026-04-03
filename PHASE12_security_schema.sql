-- PHASE 12: Security Hardening & Compliance - Database Schema
-- Role-Based Access Control (RBAC) & Audit Logging

CREATE TABLE IF NOT EXISTS rbac_roles (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSON NOT NULL DEFAULT '[]',
  organizationId VARCHAR(255) NOT NULL,
  isBuiltIn BOOLEAN DEFAULT false,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deletedAt TIMESTAMP NULL,
  
  UNIQUE KEY idx_organization_role (organizationId, name),
  KEY idx_organizationId (organizationId),
  KEY idx_isBuiltIn (isBuiltIn),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User to Role assignment
CREATE TABLE IF NOT EXISTS rbac_user_roles (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  roleId VARCHAR(255) NOT NULL,
  organizationId VARCHAR(255) NOT NULL,
  assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assignedBy VARCHAR(255) NOT NULL,
  assignmentContext JSON,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY idx_user_role_org (userId, roleId, organizationId),
  KEY idx_userId (userId),
  KEY idx_roleId (roleId),
  KEY idx_organizationId (organizationId),
  FOREIGN KEY (roleId) REFERENCES rbac_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Logs - Complete action trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resourceId VARCHAR(255),
  severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
  status ENUM('success', 'failure', 'denied') NOT NULL,
  changes JSON,
  metadata JSON,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_organizationId (organizationId),
  KEY idx_userId (userId),
  KEY idx_timestamp (timestamp),
  KEY idx_severity (severity),
  KEY idx_status (status),
  KEY idx_resource (resource),
  KEY idx_action (action),
  COMPOSITE KEY idx_organization_timestamp (organizationId, timestamp),
  COMPOSITE KEY idx_user_timestamp (userId, timestamp),
  COMPOSITE KEY idx_resource_action (resource, action),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compliance Events - Track compliance-related incidents
CREATE TABLE IF NOT EXISTS compliance_events (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  eventType ENUM('policy_change', 'role_change', 'permission_denied', 'suspicious_activity', 'access_violation') NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  description TEXT NOT NULL,
  userId VARCHAR(255) NOT NULL,
  resourceType VARCHAR(100) NOT NULL,
  resourceId VARCHAR(255),
  metadata JSON,
  resolved BOOLEAN DEFAULT false,
  resolvedAt TIMESTAMP NULL,
  resolvedBy VARCHAR(255),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_organizationId (organizationId),
  KEY idx_userId (userId),
  KEY idx_eventType (eventType),
  KEY idx_severity (severity),
  KEY idx_resolved (resolved),
  KEY idx_timestamp (timestamp),
  COMPOSITE KEY idx_organization_timestamp (organizationId, timestamp),
  COMPOSITE KEY idx_severity_resolved (severity, resolved),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compliance Reports - Periodic compliance snapshots
CREATE TABLE IF NOT EXISTS compliance_reports (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  reportType ENUM('daily', 'weekly', 'monthly', 'annual') NOT NULL,
  startDate TIMESTAMP NOT NULL,
  endDate TIMESTAMP NOT NULL,
  totalEvents INT NOT NULL DEFAULT 0,
  criticalEvents INT NOT NULL DEFAULT 0,
  securityIncidents INT NOT NULL DEFAULT 0,
  accessViolations INT NOT NULL DEFAULT 0,
  policyChanges INT NOT NULL DEFAULT 0,
  summary TEXT,
  generatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generatedBy VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_organizationId (organizationId),
  KEY idx_reportType (reportType),
  KEY idx_generatedAt (generatedAt),
  KEY idx_startDate (startDate),
  COMPOSITE KEY idx_organization_period (organizationId, startDate, endDate),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Access Control Policies - Fine-grained access rules
CREATE TABLE IF NOT EXISTS access_policies (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  policyType ENUM('allow', 'deny') DEFAULT 'allow',
  conditions JSON NOT NULL,
  resources JSON NOT NULL,
  actions JSON NOT NULL,
  roles JSON,
  users JSON,
  ipWhitelist JSON,
  timeRestrictions JSON,
  isActive BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY idx_organization_name (organizationId, name),
  KEY idx_organizationId (organizationId),
  KEY idx_isActive (isActive),
  KEY idx_priority (priority),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Security Policies - Organization security settings
CREATE TABLE IF NOT EXISTS security_policies (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  policyName VARCHAR(100) NOT NULL,
  policyCategory ENUM('password', 'session', 'mfa', 'encryption', 'audit', 'compliance') NOT NULL,
  description TEXT,
  settings JSON NOT NULL,
  isEnabled BOOLEAN DEFAULT true,
  appliesTo JSON,
  exceptions JSON,
  lastReviewedAt TIMESTAMP,
  reviewedBy VARCHAR(255),
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY idx_organization_policy (organizationId, policyName),
  KEY idx_organizationId (organizationId),
  KEY idx_policyCategory (policyCategory),
  KEY idx_isEnabled (isEnabled),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Password Policy History - Track password changes
CREATE TABLE IF NOT EXISTS password_history (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  changedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changedBy VARCHAR(255),
  reason VARCHAR(100),
  
  KEY idx_userId (userId),
  KEY idx_changedAt (changedAt),
  COMPOSITE KEY idx_user_time (userId, changedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session Audit - Track user sessions
CREATE TABLE IF NOT EXISTS session_audit (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  organizationId VARCHAR(255) NOT NULL,
  sessionId VARCHAR(255) NOT NULL,
  loginAt TIMESTAMP NOT NULL,
  logoutAt TIMESTAMP,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  deviceInfo JSON,
  loginMethod ENUM('password', 'sso', 'mfa', 'api_key') DEFAULT 'password',
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY idx_sessionId (sessionId),
  KEY idx_userId (userId),
  KEY idx_organizationId (organizationId),
  KEY idx_loginAt (loginAt),
  KEY idx_isActive (isActive),
  COMPOSITE KEY idx_user_login (userId, loginAt),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data Access Records - Who accessed what data
CREATE TABLE IF NOT EXISTS data_access_logs (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  dataType VARCHAR(100) NOT NULL,
  dataId VARCHAR(255) NOT NULL,
  accessType ENUM('read', 'write', 'delete', 'export') NOT NULL,
  accessedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ipAddress VARCHAR(45),
  purpose VARCHAR(255),
  isAuthorized BOOLEAN DEFAULT true,
  
  KEY idx_organizationId (organizationId),
  KEY idx_userId (userId),
  KEY idx_dataType (dataType),
  KEY idx_accessedAt (accessedAt),
  KEY idx_isAuthorized (isAuthorized),
  COMPOSITE KEY idx_data_access (dataType, dataId, accessedAt),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compliance Frameworks - Track compliance status
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  frameworkName ENUM('SOC2', 'HIPAA', 'GDPR', 'PCI_DSS', 'ISO27001') NOT NULL,
  isEnabled BOOLEAN DEFAULT true,
  requirements JSON NOT NULL,
  complianceStatus JSON,
  lastAssessmentAt TIMESTAMP,
  nextAssessmentAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY idx_organization_framework (organizationId, frameworkName),
  KEY idx_organizationId (organizationId),
  KEY idx_isEnabled (isEnabled),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Incident Response - Track security incidents
CREATE TABLE IF NOT EXISTS incidents (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  incidentType ENUM('security_breach', 'unauthorized_access', 'data_loss', 'policy_violation', 'suspicious_activity') NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  description TEXT NOT NULL,
  discoveredAt TIMESTAMP NOT NULL,
  reportedBy VARCHAR(255) NOT NULL,
  respondedBy VARCHAR(255),
  status ENUM('open', 'investigating', 'contained', 'resolved', 'closed') DEFAULT 'open',
  rootCause TEXT,
  correktivActions JSON,
  resolvedAt TIMESTAMP,
  externalNotified BOOLEAN DEFAULT false,
  notificationDate TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_organizationId (organizationId),
  KEY idx_severity (severity),
  KEY idx_status (status),
  KEY idx_incidentType (incidentType),
  KEY idx_discoveredAt (discoveredAt),
  COMPOSITE KEY idx_org_severity (organizationId, severity),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API Access Logs - Track API usage and access
CREATE TABLE IF NOT EXISTS api_access_logs (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  organizationId VARCHAR(255) NOT NULL,
  userId VARCHAR(255),
  apiKeyId VARCHAR(255),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  statusCode INT,
  responseTime INT,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  requestPayload JSON,
  errorMessage TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_organizationId (organizationId),
  KEY idx_userId (userId),
  KEY idx_apiKeyId (apiKeyId),
  KEY idx_endpoint (endpoint),
  KEY idx_statusCode (statusCode),
  KEY idx_timestamp (timestamp),
  COMPOSITE KEY idx_org_time (organizationId, timestamp),
  COMPOSITE KEY idx_api_status (apiKeyId, statusCode, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permission Change History - Audit trail for permission changes
CREATE TABLE IF NOT EXISTS permission_changes (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  roleId VARCHAR(255) NOT NULL,
  oldPermissions JSON,
  newPermissions JSON,
  changedBy VARCHAR(255) NOT NULL,
  reason VARCHAR(255),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  KEY idx_roleId (roleId),
  KEY idx_timestamp (timestamp),
  COMPOSITE KEY idx_role_time (roleId, timestamp),
  FOREIGN KEY (roleId) REFERENCES rbac_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================

-- Optimize audit log queries
CREATE INDEX idx_audit_org_severity_time ON audit_logs(organizationId, severity, timestamp DESC);
CREATE INDEX idx_audit_resource_time ON audit_logs(resource, action, timestamp DESC);

-- Optimize compliance event queries
CREATE INDEX idx_compliance_severity_resolved ON compliance_events(organizationId, severity, resolved, timestamp DESC);
CREATE INDEX idx_compliance_type_time ON compliance_events(eventType, timestamp DESC);

-- Optimize access policy queries
CREATE INDEX idx_policy_active_priority ON access_policies(organizationId, isActive, priority);

-- Optimize session queries
CREATE INDEX idx_session_active_login ON session_audit(userId, isActive, loginAt DESC);

-- Optimize data access queries
CREATE INDEX idx_data_access_type_time ON data_access_logs(dataType, accessedAt DESC);

-- ===================================================
-- VERIFY SCHEMA
-- ===================================================

-- Show all created tables
SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  DATA_LENGTH,
  INDEX_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'devpulse_billing'
AND TABLE_NAME LIKE '%rbac%' OR TABLE_NAME LIKE '%audit%' OR TABLE_NAME LIKE '%compliance%' OR TABLE_NAME LIKE '%policy%' OR TABLE_NAME LIKE '%session%' OR TABLE_NAME LIKE '%incident%'
ORDER BY TABLE_NAME;

-- Show indexes
SELECT 
  TABLE_NAME,
  INDEX_NAME,
  SEQ_IN_INDEX,
  COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'devpulse_billing'
AND TABLE_NAME LIKE '%rbac%' OR TABLE_NAME LIKE '%audit%' OR TABLE_NAME LIKE '%compliance%'
ORDER BY TABLE_NAME, INDEX_NAME;
