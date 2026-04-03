CREATE TABLE IF NOT EXISTS "apiKeys" (
  "id" serial PRIMARY KEY NOT NULL,
  "workspaceId" integer NOT NULL,
  "service" varchar(64) NOT NULL,
  "maskedKey" varchar(16) NOT NULL,
  "encryptedKey" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
