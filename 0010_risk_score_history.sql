/**
 * DevPulse Risk Score History Migration
 * ======================================
 * Stores historical unified risk score snapshots for trend analysis.
 * Run after all preceding migrations.
 */

CREATE TABLE IF NOT EXISTS `riskScoreHistory` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `workspaceId` INT NOT NULL,
  `date` VARCHAR(10) NOT NULL COMMENT 'YYYY-MM-DD',
  `unifiedScore` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '0-100 combined risk',
  `securityScore` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '0-100 security component',
  `costScore` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '0-100 cost component',
  `riskTier` VARCHAR(16) NOT NULL DEFAULT 'HEALTHY' COMMENT 'CRITICAL|HIGH|MEDIUM|LOW|HEALTHY',
  `vulnerabilityCount` INT NOT NULL DEFAULT 0,
  `criticalVulnCount` INT NOT NULL DEFAULT 0,
  `highVulnCount` INT NOT NULL DEFAULT 0,
  `costUsd` DECIMAL(12,4) NOT NULL DEFAULT 0,
  `budgetPercent` DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT 'pct of monthly budget used',
  `agentInterventions` INT NOT NULL DEFAULT 0 COMMENT 'AgentGuard kill events this day',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `rsh_workspace_date_idx` (`workspaceId`, `date`),
  UNIQUE KEY `rsh_workspace_date_unique` (`workspaceId`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
