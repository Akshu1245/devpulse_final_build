-- PHASE 7: Add Endpoint Path Tracking to Cost and Thinking Tables
-- These migrations add the apiPath field to existing tables to track which endpoint triggered each LLM call

-- Add apiPath to llmCostEvents table
-- This allows correlating LLM costs to specific API endpoints
ALTER TABLE llmCostEvents 
ADD COLUMN IF NOT EXISTS apiPath VARCHAR(512) COMMENT 'API endpoint that triggered this LLM call';

-- Add index for efficient endpoint-level queries
ALTER TABLE llmCostEvents 
ADD INDEX IF NOT EXISTS llm_api_path_idx (apiPath);

-- Add apiPath to llmThinkingAttributions table
-- This allows identifying which endpoints use expensive thinking tokens
ALTER TABLE llmThinkingAttributions 
ADD COLUMN IF NOT EXISTS apiPath VARCHAR(512) COMMENT 'API endpoint where thinking tokens were used';

-- Add index for efficient endpoint-level queries
ALTER TABLE llmThinkingAttributions 
ADD INDEX IF NOT EXISTS thinking_api_path_idx (apiPath);

-- Query: Get endpoint-level cost breakdown
-- SELECT 
--   apiPath,
--   provider,
--   model,
--   COUNT(*) as calls,
--   SUM(totalTokens) as total_tokens,
--   SUM(CAST(costUsd AS DECIMAL(12,8))) as total_cost,
--   AVG(CAST(costUsd AS DECIMAL(12,8))) as avg_cost_per_call
-- FROM llmCostEvents
-- WHERE workspaceId = ? AND apiPath IS NOT NULL
-- GROUP BY apiPath, provider, model
-- ORDER BY total_cost DESC;

-- Query: Get thinking token usage by endpoint
-- SELECT 
--   apiPath,
--   feature,
--   SUM(thinkingTokens) as total_thinking_tokens,
--   SUM(CAST(estimatedCostUsd AS DECIMAL(12,8))) as thinking_cost,
--   COUNT(*) as calls
-- FROM llmThinkingAttributions
-- WHERE workspaceId = ? AND apiPath IS NOT NULL
-- GROUP BY apiPath, feature
-- ORDER BY total_thinking_tokens DESC;

-- Query: Find most expensive endpoints
-- SELECT 
--   c.apiPath,
--   COUNT(DISTINCT DATE(FROM_UNIXTIME(c.eventTimestamp / 1000))) as days_active,
--   SUM(CAST(c.costUsd AS DECIMAL(12,8))) as total_cost,
--   COUNT(c.id) as api_calls,
--   COALESCE(SUM(t.thinkingTokens), 0) as thinking_tokens
-- FROM llmCostEvents c
-- LEFT JOIN llmThinkingAttributions t ON c.workspaceId = t.workspaceId 
--   AND c.eventTimestamp = t.timestamp
-- WHERE c.workspaceId = ? AND c.apiPath IS NOT NULL
-- GROUP BY c.apiPath
-- ORDER BY total_cost DESC;
