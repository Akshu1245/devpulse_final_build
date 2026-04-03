-- Add composite index to optimize workspace+severity filtering and grouping
-- Used by security.criticalCount and severity summary queries.

CREATE INDEX vuln_workspace_severity_idx
ON vulnerabilities (workspaceId, severity);
