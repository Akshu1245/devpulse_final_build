-- PHASE 7: Shadow API Whitelist Table
-- Approved shadow APIs (suppresses false positives)
-- Tracks endpoints that should not be flagged as suspicious

CREATE TABLE IF NOT EXISTS shadowApiWhitelist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspaceId INT NOT NULL,
  apiPath VARCHAR(512) NOT NULL COMMENT 'Normalized path (e.g., POST /api/scan/{id}/internal)',
  approved BOOLEAN DEFAULT TRUE NOT NULL COMMENT 'True if whitelisted',
  reason TEXT COMMENT 'Why this shadow API was approved (e.g., "Internal batch processing endpoint")',
  approvedBy INT COMMENT 'User ID who approved this whitelist entry',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  INDEX whitelist_workspace_path_idx (workspaceId, apiPath),
  INDEX whitelist_workspace_idx (workspaceId),
  UNIQUE INDEX whitelist_workspace_path_uk (workspaceId, apiPath),
  
  -- Constraints
  CONSTRAINT fk_whitelist_workspace FOREIGN KEY (workspaceId) 
    REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_whitelist_user FOREIGN KEY (approvedBy) 
    REFERENCES users(id) ON DELETE SET NULL
);

-- Query: Get all whitelisted endpoints for workspace
-- SELECT apiPath FROM shadowApiWhitelist 
-- WHERE workspaceId = ? AND approved = TRUE
-- ORDER BY createdAt DESC;

-- Query: Get recent whitelist approvals
-- SELECT 
--   apiPath, 
--   reason, 
--   CONCAT('User ', approvedBy) as approved_by,
--   createdAt
-- FROM shadowApiWhitelist
-- WHERE workspaceId = ? AND approved = TRUE
-- ORDER BY createdAt DESC
-- LIMIT 10;
