-- PHASE 7: Shadow API Detections Table
-- Results from shadow API detection engine
-- Records endpoints that are called but not in Postman collections

CREATE TABLE IF NOT EXISTS shadowApiDetections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspaceId INT NOT NULL,
  apiPath VARCHAR(512) NOT NULL COMMENT 'e.g., POST /api/scan/internal_analyze',
  riskScore INT DEFAULT 0 NOT NULL COMMENT '0-100 scale',
  riskTier VARCHAR(16) DEFAULT 'LOW' NOT NULL COMMENT 'CRITICAL, HIGH, MEDIUM, LOW',
  detectionMethods JSON NOT NULL COMMENT 'Array of detection reasons (undocumented, expensive_thinking, latency_anomaly, etc.)',
  costImpact DECIMAL(12, 8) NOT NULL COMMENT 'Total cost from this endpoint',
  thinkingTokens INT DEFAULT 0 NOT NULL COMMENT 'Total thinking tokens used',
  frequency INT DEFAULT 0 NOT NULL COMMENT 'Number of API calls to this endpoint',
  confidence VARCHAR(16) NOT NULL COMMENT 'HIGH, MEDIUM, LOW confidence in detection',
  details JSON COMMENT 'Additional metadata (models used, latency stats, etc.)',
  isWhitelisted BOOLEAN DEFAULT FALSE NOT NULL COMMENT 'True if approved as shadow API',
  whitelistReason TEXT COMMENT 'Why this endpoint was whitelisted',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for fast queries
  INDEX shadow_workspace_idx (workspaceId),
  INDEX shadow_api_path_idx (apiPath),
  INDEX shadow_risk_score_idx (riskScore),
  INDEX shadow_created_idx (createdAt),
  UNIQUE INDEX shadow_workspace_path_uk (workspaceId, apiPath),
  
  -- Constraints
  CONSTRAINT fk_shadow_workspace FOREIGN KEY (workspaceId) 
    REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Query: Get top shadow APIs by risk
-- SELECT 
--   apiPath, 
--   riskScore, 
--   riskTier, 
--   frequency, 
--   costImpact,
--   detectionMethods
-- FROM shadowApiDetections
-- WHERE workspaceId = ? AND isWhitelisted = FALSE
-- ORDER BY riskScore DESC
-- LIMIT 20;

-- Query: Risk score distribution
-- SELECT 
--   riskTier, 
--   COUNT(*) as count,
--   AVG(riskScore) as avg_risk,
--   SUM(costImpact) as total_cost
-- FROM shadowApiDetections
-- WHERE workspaceId = ? AND isWhitelisted = FALSE
-- GROUP BY riskTier;
