/**
 * DevPulse Server Entry Point
 * ============================
 * Express server with tRPC, Swagger UI, and WebSocket support.
 * Run: node dist/server.js  (after npm run build)
 * Dev:  npx tsx --watch server.ts
 */

import "dotenv/config";
import express, { Request as ExpressRequest, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";
import { ENV, validateEnv } from "./_core/env";
import { openApiSpec, generateSwaggerPage } from "./_core/openapi";

const { initializeWebSocketHub } = require("./_services/websocketHub");
const { gracefulShutdown } = require("./_services/gracefulShutdown");
const { metricsMiddleware, metricsRoute } = require("./_services/prometheus");
const { healthCheckRoute } = require("./_services/healthCheck");
const { startIncidentMonitoring } = require("./_services/incidentResponse");
const { startAccessLogProcessor } = require("./_workers/queues/accessLogQueue");
const { agentGuardMiddleware } = require("./middleware/agentGuardMiddleware");
const { httpAccessLogMiddleware } = require("./middleware/httpAccessLog");

// Extended Request type with custom properties
interface DevPulseRequest extends ExpressRequest {
  requestId?: string;
  user?: { id: string; name?: string };
  cookies: Record<string, string>;
}

// ─── Validate environment on startup ───────────────────────
const { valid, errors } = validateEnv();
if (!valid) {
  console.error("[SERVER] ❌ Missing required environment variables:", errors);
  if (ENV.IS_PRODUCTION && !ENV.IS_VERCEL) process.exit(1);
}

// ─── Express App ────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);

// ─── Rate Limiting ──────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  skip: (req: any) => req.path === '/health' || req.path === '/metrics',
});

const scanLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many scan requests. Maximum 10 scans per minute.' },
});

app.use(globalLimiter);

// ─── Security & Performance Middleware ───────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "unpkg.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));

// Optimized compression
app.use(compression({
  filter: (req: ExpressRequest, res: Response) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 512,
}));

// Enhanced CORS configuration
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowed = ENV.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
    const isDev = ENV.IS_DEVELOPMENT;
    
    if (!origin || isDev) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    
    callback(new Error(`CORS blocked: ${origin} is not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-id', 'x-workspace-id', 'x-csrf-token'],
}));

app.use(express.json({ limit: "10mb" }));

// ─── CSRF Protection (Double Submit Cookie Pattern) ─────────
// Decision: this app uses stateless auth patterns, so CSRF defaults to
// double-submit cookie strategy (no server-side session storage required).
const csrfProtection = (req: DevPulseRequest, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods and webhooks
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const isWebhook = req.path.includes('/webhook');
  const isHealthCheck = req.path === '/health' || req.path === '/metrics';
  
  if (safeMethods.includes(req.method) || isWebhook || isHealthCheck) {
    return next();
  }

  const strategy = (ENV.CSRF_STRATEGY || 'double-submit').toLowerCase();

  // Strict browser origin checks for unsafe methods.
  const allowedOrigins = new Set(
    [
      ...(ENV.CORS_ORIGINS ? ENV.CORS_ORIGINS.split(',').map((o) => o.trim()) : []),
      ENV.FRONTEND_URL,
      ENV.CORS_ORIGIN,
    ].filter(Boolean)
  );
  const requestOrigin = req.headers.origin;
  const requestReferer = req.headers.referer;
  const refererOrigin = requestReferer ? (() => {
    try {
      return new URL(requestReferer).origin;
    } catch {
      return undefined;
    }
  })() : undefined;

  if (ENV.IS_PRODUCTION) {
    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      return res.status(403).json({ error: 'Invalid request origin' });
    }
    if (!requestOrigin && refererOrigin && !allowedOrigins.has(refererOrigin)) {
      return res.status(403).json({ error: 'Invalid request referer' });
    }
  }

  if (strategy === 'none') {
    return next();
  }

  if (strategy === 'origin-only') {
    return next();
  }

  // Non-browser clients using Bearer tokens are not cookie-authenticated,
  // so CSRF token checks are not required for them.
  const authHeader = req.headers.authorization;
  const isBearerClient = !!authHeader && authHeader.toLowerCase().startsWith('bearer ');
  if (isBearerClient && !req.cookies?.['csrf-token']) {
    return next();
  }
  
  // Generate CSRF token if not present
  let csrfToken = req.cookies?.['csrf-token'];
  if (!csrfToken) {
    csrfToken = crypto.randomUUID();
    res.cookie('csrf-token', csrfToken, {
      httpOnly: false, // Must be readable by JS for double-submit
      secure: ENV.IS_PRODUCTION,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
  }
  
  // Verify CSRF token for state-changing requests
  const headerToken = req.headers['x-csrf-token'] as string | undefined;
  if (!headerToken || headerToken !== csrfToken) {
    console.warn('[CSRF] Token mismatch', { path: req.path, ip: req.ip });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
};

// Cookie parser for CSRF
app.use((req: DevPulseRequest, res: Response, next: NextFunction) => {
  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie: string) => {
      const [name, ...rest] = cookie.trim().split('=');
      cookies[name] = rest.join('=');
    });
  }
  req.cookies = cookies;
  next();
});

app.use(csrfProtection);

// ─── HTTP Access Logging (Fire-and-forget to DB) ────────────
app.use(httpAccessLogMiddleware);

// ─── Request Logging Middleware ──────────────────────────────
app.use((req: DevPulseRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  
  req.requestId = requestId;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.id,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
    
    if (res.statusCode >= 500) {
      console.error('[Request]', JSON.stringify(log));
    } else if (duration > 1000) {
      console.warn('[Slow Request]', JSON.stringify(log));
    } else {
      console.log('[Request]', JSON.stringify(log));
    }
  });
  
  next();
});

// ─── Prometheus Metrics ─────────────────────────────────────
app.use(metricsMiddleware);
app.get("/metrics", metricsRoute);

// ─── Health Check ────────────────────────────────────────────
app.get("/health", healthCheckRoute);
app.get("/api/health", healthCheckRoute);

// ─── Swagger / OpenAPI Docs ──────────────────────────────────
app.get("/openapi.json", (_req: any, res: any) => {
  res.json(openApiSpec);
});
app.get("/docs", (_req: any, res: any) => {
  res.setHeader("Content-Type", "text/html");
  res.send(generateSwaggerPage(ENV.API_URL));
});

// ─── tRPC API ───────────────────────────────────────────────
// Apply scan limiter to scan endpoints
app.use('/trpc/scan', scanLimiter);

// AgentGuard middleware - blocks killed agents
app.use(agentGuardMiddleware);

app.all("/trpc/*", (req: any, res: any) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: req as unknown as globalThis.Request,
    router: appRouter,
    createContext,
    onError: ({ error, path }: { error: any; path: any }) => {
      if (error.code !== "NOT_FOUND") {
        console.error(`[tRPC] Error on ${path}:`, error);
      }
    },
  }).then((response: any) => {
    response.headers.forEach((value: any, key: any) => res.setHeader(key, value));
    res.status(response.status).send(response.body);
  });
});

// ─── WebSocket Hub (Real-time AgentGuard alerts) ─────────────
initializeWebSocketHub(httpServer);

// ─── Background Services ─────────────────────────────────────
// startIncidentMonitoring(1); // Uncomment and provide workspaceId when needed
// startAccessLogProcessor(); // Uncomment when Redis is configured

// ─── 404 Handler ─────────────────────────────────────────────
app.use((_req: any, res: any) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Start Server ─────────────────────────────────────────────
httpServer.listen(ENV.PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║     DevPulse API Server — Running        ║
  ╠══════════════════════════════════════════╣
  ║  API:      http://localhost:${ENV.PORT}/trpc  ║
  ║  Docs:     http://localhost:${ENV.PORT}/docs  ║
  ║  Health:   http://localhost:${ENV.PORT}/health║
  ║  Metrics:  http://localhost:${ENV.PORT}/metrics║
  ╚══════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ────────────────────────────────────────
process.on("SIGTERM", () => gracefulShutdown(httpServer));
process.on("SIGINT", () => gracefulShutdown(httpServer));

export { app, httpServer };
