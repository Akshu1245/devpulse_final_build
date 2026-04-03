-- Performance indexes for DevPulse production database
-- Created to optimize query performance and reduce load times

-- Scan-related indexes
CREATE INDEX IF NOT EXISTS scan_user_idx ON scans(userId);
CREATE INDEX IF NOT EXISTS scan_workspace_created_idx ON scans(workspaceId, createdAt DESC);

-- Vulnerability indexes
CREATE INDEX IF NOT EXISTS vuln_scan_severity_idx ON vulnerabilities(scanId, severity);
CREATE INDEX IF NOT EXISTS vuln_workspace_status_idx ON vulnerabilities(workspaceId, status);
CREATE INDEX IF NOT EXISTS vuln_category_idx ON vulnerabilities(category);

-- LLM Cost indexes
CREATE INDEX IF NOT EXISTS llm_cost_feature_idx ON llmCostEvents(featureName, eventTimestamp DESC);
CREATE INDEX IF NOT EXISTS llm_cost_workspace_idx ON llmCostEvents(workspaceId, eventTimestamp DESC);

-- Activity log index
CREATE INDEX IF NOT EXISTS activity_user_idx ON activityLog(userId, createdAt DESC);

-- Thinking attribution index
CREATE INDEX IF NOT EXISTS thinking_workspace_idx ON llmThinkingAttributions(workspaceId, timestamp DESC);

-- Shadow API detection index
CREATE INDEX IF NOT EXISTS shadow_api_workspace_idx ON shadowApiDetections(workspaceId, riskTier);

-- Agent Guard event index
CREATE INDEX IF NOT EXISTS agent_guard_workspace_idx ON agentguardEvents(workspaceId, timestamp DESC);

-- Risk score history index
CREATE INDEX IF NOT EXISTS risk_history_workspace_idx ON riskScoreHistory(workspaceId, recordedAt DESC);

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS api_keys_workspace_hash_idx ON apiKeys(workspaceId, keyHash);
CREATE INDEX IF NOT EXISTS webhook_configs_workspace_idx ON webhookConfigs(workspaceId, isActive);
