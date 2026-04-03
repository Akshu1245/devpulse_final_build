CREATE TABLE IF NOT EXISTS "activityLog" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspaceId" integer NOT NULL,
  "type" varchar(64) NOT NULL,
  "title" varchar(256) NOT NULL,
  "description" text,
  "severity" varchar(32),
  "metadata" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
