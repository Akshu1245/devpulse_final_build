-- PHASE 7: HTTP Access Log Table
-- Persistent logging of all HTTP API calls for shadow API detection

CREATE TABLE IF NOT EXISTS httpAccessLog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workspaceId INT,
  userId INT,
  method VARCHAR(16) NOT NULL COMMENT 'GET, POST, PUT, DELETE, PATCH, etc.',
  path VARCHAR(512) NOT NULL COMMENT '/api/scan/:id, /api/vulnerabilities, etc.',
  statusCode INT NOT NULL COMMENT 'HTTP status code (200, 404, 500, etc.)',
  latencyMs INT NOT NULL COMMENT 'Response time in milliseconds',
  ipAddress VARCHAR(45) COMMENT 'Client IP address (IPv4 or IPv6)',
  userAgent TEXT COMMENT 'User-Agent header from request',
  queryParams JSON COMMENT 'URL query parameters',
  requestTimestamp BIGINT NOT NULL COMMENT 'Milliseconds since epoch when request was made',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- Indexes for fast queries
  INDEX http_workspace_path_idx (workspaceId, path),
  INDEX http_method_path_idx (method, path),
  INDEX http_timestamp_idx (requestTimestamp),
  INDEX http_status_idx (statusCode),
  
  -- Constraints
  CONSTRAINT fk_http_workspace FOREIGN KEY (workspaceId) 
    REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Retention policy: Delete logs older than 90 days (optional, implement as separate scheduled job)
-- DELETE FROM httpAccessLog WHERE requestTimestamp < (UNIX_TIMESTAMP() * 1000 - 90 * 24 * 60 * 60 * 1000);

-- Index analysis query: Find slow endpoints
-- SELECT 
--   method, 
--   path, 
--   COUNT(*) as calls, 
--   AVG(latencyMs) as avg_latency,
--   MAX(latencyMs) as max_latency,
--   SUM(CASE WHEN statusCode >= 400 THEN 1 ELSE 0 END) as errors
-- FROM httpAccessLog
-- WHERE requestTimestamp > (UNIX_TIMESTAMP() * 1000 - 7 * 24 * 60 * 60 * 1000)
-- GROUP BY method, path
-- ORDER BY avg_latency DESC;
