/**
 * Security Middleware
 * ===================
 * Rate limiting, security headers, input validation, and request protection.
 */

import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { getApiKeyByHash } from "../db";
import { ENV } from "../_core/env";

// ─────────────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked?: boolean;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Create a rate limiter middleware.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  blockDurationMs?: number;
}) {
  const { windowMs, maxRequests, keyGenerator, blockDurationMs = 5 * 60 * 1000 } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || "unknown";
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Initialize or reset if window expired
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
    }

    // Check if blocked
    if (entry.blocked && entry.resetTime > now) {
      res.status(429).json({
        error: "Too many requests",
        message: "You have been temporarily blocked due to excessive requests",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return;
    }

    // Increment count
    entry.count++;

    // Check limit
    if (entry.count > maxRequests) {
      entry.blocked = true;
      entry.resetTime = now + blockDurationMs;
      rateLimitStore.set(key, entry);

      res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil(blockDurationMs / 1000),
      });
      return;
    }

    rateLimitStore.set(key, entry);

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    next();
  };
}

// Default rate limiter (100 requests per minute per IP)
export const rateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

// Stricter rate limiter for sensitive endpoints
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  blockDurationMs: 15 * 60 * 1000,
});

// ─────────────────────────────────────────────────────────────────────────
// API KEY VALIDATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Middleware to validate API key from X-API-Key header.
 */
export async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    // API key is optional - tRPC will handle auth via session
    next();
    return;
  }

  try {
    const hash = createHash("sha256").update(apiKey).digest("hex");
    const keyRecord = await getApiKeyByHash(hash);

    if (!keyRecord || keyRecord.revokedAt) {
      res.status(401).json({
        error: "Invalid or revoked API key",
        message: "The provided API key is invalid or has been revoked.",
      });
      return;
    }

    // Attach to request
    (req as any).apiKey = {
      id: keyRecord.id,
      workspaceId: keyRecord.workspaceId,
      userId: keyRecord.userId,
    };

    // Update last used
    // (Fire and forget - don't block the request)
    // updateApiKeyLastUsed(keyRecord.id).catch(() => {});

    next();
  } catch (error) {
    console.error("[Security] API key validation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Add security headers to all responses.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Strict transport security (HTTPS only in production)
  if (ENV.IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), interest-cohort=()"
  );

  // Cache control for API responses
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
}

// ─────────────────────────────────────────────────────────────────────────
// REQUEST VALIDATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Validate request size and content type.
 */
export function validateRequest(req: Request, res: Response, next: NextFunction) {
  // Check content type for POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"];
    if (contentType && !contentType.includes("application/json") && !contentType.includes("multipart/form-data")) {
      res.status(415).json({
        error: "Unsupported Media Type",
        message: "Content-Type must be application/json or multipart/form-data",
      });
      return;
    }
  }

  // Check request size (max 10MB)
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > 10 * 1024 * 1024) {
    res.status(413).json({
      error: "Payload Too Large",
      message: "Request body exceeds maximum size of 10MB",
    });
    return;
  }

  next();
}

// ─────────────────────────────────────────────────────────────────────────
// REQUEST LOGGING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Log all requests for monitoring and debugging.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Log request details
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 100),
    };

    if (statusCode >= 500) {
      console.error("[Request]", logData);
    } else if (statusCode >= 400) {
      console.warn("[Request]", logData);
    } else if (duration > 1000) {
      console.warn("[Slow Request]", logData);
    } else if (ENV.LOG_LEVEL === "debug") {
      console.log("[Request]", logData);
    }

    // PHASE 7: Fire-and-forget insert to httpAccessLog
    // Non-blocking: doesn't wait for DB response
    if (req.path?.startsWith("/api/") && process.env.DATABASE_URL) {
      try {
        // Import here to avoid circular dependency
        const { logHttpAccessEvent } = require("../db");
        
        logHttpAccessEvent({
          workspaceId: (req as any).workspaceId, // Extract from auth context if available
          userId: (req as any).userId, // Extract from auth context if available
          method: req.method,
          path: req.path,
          statusCode: statusCode,
          latencyMs: duration,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"]?.slice(0, 200),
          queryParams: req.query as any,
          requestTimestamp: start,
        }).catch(() => {
          // Silently fail: don't interrupt request
        });
      } catch (err) {
        // Silently fail: don't interrupt request
      }
    }

    return originalSend.call(this, data);
  };

  next();
}

// ─────────────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Global error handler for uncaught exceptions.
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("[Error]", {
    message: err.message,
    stack: ENV.IS_PRODUCTION ? undefined : err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err.name === "ValidationError") {
    res.status(400).json({
      error: "Validation Error",
      message: err.message,
    });
    return;
  }

  if (err.name === "UnauthorizedError") {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  // Default error response
  res.status(err.status || 500).json({
    error: ENV.IS_PRODUCTION ? "Internal Server Error" : err.message,
    message: ENV.IS_PRODUCTION
      ? "An unexpected error occurred. Please try again later."
      : err.message,
    ...(ENV.IS_DEVELOPMENT && { stack: err.stack }),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * CORS middleware with proper configuration.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // Check if origin is allowed
  const allowedOrigins = ENV.CORS_ORIGIN.split(",").map((o) => o.trim());
  const isAllowed = !origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*");

  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-API-Key, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
