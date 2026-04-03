CREATE TABLE IF NOT EXISTS "llmThinkingAttributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspaceId" integer NOT NULL,
  "eventId" integer NOT NULL,
  "feature" varchar(128) NOT NULL,
  "thinkingTokens" integer DEFAULT 0 NOT NULL,
  "estimatedCostUsd" numeric(10, 6) DEFAULT '0' NOT NULL,
  "detectionMethod" varchar(32) NOT NULL,
  "timestamp" bigint NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
