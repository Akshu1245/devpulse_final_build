/**
 * Environment Configuration
 * ==========================
 * Validates and exports environment variables with proper type safety.
 */

const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    console.warn(`[ENV] Missing required variable: ${key}`);
  }
  return value ?? "";
};

const optional = (key: string, fallback?: string): string => {
  return process.env[key] ?? fallback ?? "";
};

const number = (key: string, fallback?: number): number => {
  const value = process.env[key];
  if (!value) return fallback ?? 0;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? (fallback ?? 0) : parsed;
};

const boolean = (key: string, fallback?: boolean): boolean => {
  const value = process.env[key]?.toLowerCase();
  if (!value) return fallback ?? false;
  return value === "true" || value === "1";
};

export const ENV = {
  // Database
  DATABASE_URL: required("DATABASE_URL"),

  // Redis
  REDIS_URL: optional("REDIS_URL", "redis://localhost:6379"),
  REDIS_HOST: (() => {
    try {
      return new URL(optional("REDIS_URL", "redis://localhost:6379")).hostname || "localhost";
    } catch {
      return "localhost";
    }
  })(),
  REDIS_PORT: (() => {
    try {
      const parsed = Number(new URL(optional("REDIS_URL", "redis://localhost:6379")).port);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 6379;
    } catch {
      return 6379;
    }
  })(),

  // JWT - Enhanced validation for production - CRITICAL: Enforce strong secret
  JWT_SECRET: (() => {
    const secret = required("JWT_SECRET", "dev-secret-change-in-production");
    const isProd = optional("NODE_ENV") === "production";
    const isVercel = optional("VERCEL") === "1";
    
    // CRITICAL: In production, enforce minimum secret length
    if (isProd && secret.length < 32) {
      if (isVercel) {
        console.warn("[SECURITY] Weak JWT_SECRET on Vercel runtime; running in degraded mode");
      } else {
        throw new Error("[SECURITY] JWT_SECRET must be at least 32 characters in production");
      }
    }
    
    // Check entropy
    const uniqueChars = new Set(secret.split('')).size;
    if (isProd && uniqueChars < 10) {
      if (isVercel) {
        console.warn("[SECURITY] Low-entropy JWT_SECRET on Vercel runtime; running in degraded mode");
      } else {
        throw new Error("[SECURITY] JWT_SECRET must have high entropy (at least 10 unique characters)");
      }
    }
    return secret;
  })(),

  // Encryption Master Key - 64 hex characters (32 bytes) for AES-256
  ENCRYPTION_MASTER_KEY: optional("ENCRYPTION_MASTER_KEY", ""),

  // CORS Origins - comma-separated
  CORS_ORIGINS: optional("CORS_ORIGINS", ""),

  // CSRF strategy for browser flows.
  // Use `double-submit` for stateless JWT/cookie apps (default).
  // `origin-only` allows strict Origin/Referer checks without token.
  // `none` should only be used behind trusted gateways.
  CSRF_STRATEGY: optional("CSRF_STRATEGY", "double-submit"),

  // Slack Webhook for budget alerts
  SLACK_WEBHOOK_URL: optional("SLACK_WEBHOOK_URL"),

  // Node Environment
  NODE_ENV: optional("NODE_ENV", "development"),
  IS_PRODUCTION: optional("NODE_ENV") === "production",
  IS_DEVELOPMENT: optional("NODE_ENV") === "development",
  IS_VERCEL: optional("VERCEL") === "1",

  // Server
  PORT: number("PORT", 3000),
  API_URL: optional("API_URL", "http://localhost:3000"),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:5173"),
  CORS_ORIGIN: optional("CORS_ORIGIN", "http://localhost:5173"),

  // LLM Providers
  OPENAI_API_KEY: optional("OPENAI_API_KEY"),
  ANTHROPIC_API_KEY: optional("ANTHROPIC_API_KEY"),
  GOOGLE_AI_API_KEY: optional("GOOGLE_AI_API_KEY"),
  MISTRAL_API_KEY: optional("MISTRAL_API_KEY"),
  COHERE_API_KEY: optional("COHERE_API_KEY"),

  // Communication
  TWILIO_ACCOUNT_SID: optional("TWILIO_ACCOUNT_SID"),
  TWILIO_AUTH_TOKEN: optional("TWILIO_AUTH_TOKEN"),
  TWILIO_FROM_NUMBER: optional("TWILIO_FROM_NUMBER"),

  // Email
  SMTP_HOST: optional("SMTP_HOST"),
  SMTP_PORT: number("SMTP_PORT", 587),
  SMTP_USER: optional("SMTP_USER"),
  SMTP_PASS: optional("SMTP_PASS"),

  // Stripe
  STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_ID_PRO: optional("STRIPE_PRICE_ID_PRO"),
  STRIPE_PRICE_ID_ENTERPRISE: optional("STRIPE_PRICE_ID_ENTERPRISE"),

  // AWS S3
  AWS_ACCESS_KEY_ID: optional("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: optional("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: optional("AWS_REGION", "us-east-1"),
  AWS_S3_BUCKET: optional("AWS_S3_BUCKET"),

  // Encryption
  ENCRYPTION_KEY: optional("ENCRYPTION_KEY", "dev-encryption-key-32-bytes!!"),

  // DevPulse API URL (for CLI tool)
  DEVPULSE_API_URL: optional("DEVPULSE_API_URL", "https://api.devpulse.in"),

  // Owner (for admin operations)
  ownerOpenId: optional("OWNER_OPEN_ID"),

  // Logging
  LOG_LEVEL: optional("LOG_LEVEL", "info"),

  // DevPulse Config
  SCAN_TIMEOUT: number("DEVPULSE_SCAN_TIMEOUT", 300000),
  MAX_ENDPOINTS_PER_SCAN: number("DEVPULSE_MAX_ENDPOINTS_PER_SCAN", 1000),
  API_RATE_LIMIT: number("DEVPULSE_API_RATE_LIMIT", 1000),

  // Feature Flags
  ENABLE_THINKING_TOKEN_TRACKING: boolean("ENABLE_THINKING_TOKEN_TRACKING", true),
  ENABLE_AGENTGUARD: boolean("ENABLE_AGENTGUARD", true),
  ENABLE_COMPLIANCE_REPORTS: boolean("ENABLE_COMPLIANCE_REPORTS", true),
  ENABLE_STRIPE_BILLING: boolean("ENABLE_STRIPE_BILLING", false),
} as const;

export type Env = typeof ENV;

// Validation function - enhanced for production security
export function validateEnv(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isVercel = ENV.IS_VERCEL;

  if (!ENV.DATABASE_URL && !isVercel) {
    errors.push("DATABASE_URL is required");
  }

  // JWT_SECRET validation
  if (ENV.IS_PRODUCTION && !isVercel) {
    if (ENV.JWT_SECRET.length < 32) {
      errors.push("JWT_SECRET must be at least 32 characters in production");
    }
    const uniqueChars = new Set(ENV.JWT_SECRET.split('')).size;
    if (uniqueChars < 10) {
      errors.push("JWT_SECRET must have high entropy (at least 10 unique characters)");
    }
  }

  // ENCRYPTION_MASTER_KEY validation for production
  if (ENV.IS_PRODUCTION && ENV.ENCRYPTION_MASTER_KEY) {
    if (ENV.ENCRYPTION_MASTER_KEY.length !== 64) {
      errors.push("ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes)");
    }
    if (!/^[0-9a-fA-F]+$/.test(ENV.ENCRYPTION_MASTER_KEY)) {
      errors.push("ENCRYPTION_MASTER_KEY must be a valid hex string");
    }
  }

  if (!["double-submit", "origin-only", "none"].includes(ENV.CSRF_STRATEGY)) {
    errors.push("CSRF_STRATEGY must be one of: double-submit, origin-only, none");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Warn on missing env vars in development
if (ENV.IS_DEVELOPMENT) {
  const { valid, errors } = validateEnv();
  if (!valid) {
    console.warn("[ENV] Missing environment variables:", errors);
  }
}
