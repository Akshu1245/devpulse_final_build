/**
 * tRPC Core Setup - Backend API Router
 * ====================================
 * Handles all backend API procedures with proper authentication and validation.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import * as jwt from "jsonwebtoken";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { getDb, getUserByOpenId } from "../db";
import { ENV } from "./env";

// ─────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────

export interface Context {
  user: {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
  db: Awaited<ReturnType<typeof getDb>>;
}

export async function createContext(opts: FetchCreateContextFnOptions): Promise<Context> {
  const cookieHeader = opts.req.headers.get("cookie") || "";
  const authHeader = opts.req.headers.get("Authorization") || "";

  let rawToken: string | null = null;

  // Try Bearer token first, then cookie
  if (authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7);
  } else {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [key, ...val] = c.trim().split("=");
        return [key, val.join("=")];
      })
    );
    rawToken = cookies.session || null;
  }

  if (!rawToken) {
    return { user: null, db: await getDb() };
  }

  // ── JWT Verification ──────────────────────────────────────
  let openId: string | null = null;
  try {
    const payload = jwt.verify(rawToken, ENV.JWT_SECRET) as { sub?: string; openId?: string };
    openId = payload.sub || payload.openId || null;
  } catch {
    // Invalid / expired token — treat as unauthenticated
    return { user: null, db: await getDb() };
  }

  if (!openId) {
    return { user: null, db: await getDb() };
  }

  const user = await getUserByOpenId(openId);

  return {
    user: user
      ? {
          id: user.id,
          openId: user.openId,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      : null,
    db: await getDb(),
  };
}


// ─────────────────────────────────────────────────────────────────────────
// TRPC INIT
// ─────────────────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create();

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// ─────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isAdmin = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }
  if (ctx.user.role !== "admin" && ctx.user.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an admin to access this resource",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const isOwner = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in",
    });
  }
  if (ctx.user.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only workspace owner can perform this action",
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(isAuthed);

// Admin procedure - requires admin role
export const adminProcedure = t.procedure.use(isAdmin);

// Owner procedure - requires owner role
export const ownerProcedure = t.procedure.use(isOwner);

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────

export const schemas = {
  // Workspace schemas
  createWorkspace: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
  }),

  workspaceId: z.object({
    workspaceId: z.number().int().positive(),
  }),

  addMember: z.object({
    workspaceId: z.number().int().positive(),
    email: z.string().email(),
    role: z.enum(["admin", "member", "viewer"]).default("member"),
  }),

  // Scan schemas
  createScan: z.object({
    workspaceId: z.number().int().positive(),
    projectId: z.number().int().positive().optional(),
    targetUrl: z.string().url(),
    endpoints: z.array(z.object({
      path: z.string(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]),
      authType: z.enum(["none", "bearer", "basic", "api_key"]).optional(),
    })).min(1),
  }),

  scanId: z.object({
    workspaceId: z.number().int().positive(),
    scanId: z.number().int().positive(),
  }),

  // Vulnerability schemas
  vulnId: z.object({
    workspaceId: z.number().int().positive(),
    vulnId: z.number().int().positive(),
  }),

  updateVulnStatus: z.object({
    vulnId: z.number().int().positive(),
    status: z.enum(["open", "acknowledged", "resolved", "wontfix"]),
  }),

  // API Key schemas
  createApiKey: z.object({
    workspaceId: z.number().int().positive(),
    name: z.string().min(1).max(128),
  }),

  revokeApiKey: z.object({
    keyId: z.number().int().positive(),
  }),

  // LLM Cost schemas
  trackLLMUsage: z.object({
    workspaceId: z.number().int().positive(),
    model: z.string().min(1),
    provider: z.string().min(1),
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    featureName: z.string().optional(),
    latencyMs: z.number().int().min(0).optional(),
    statusCode: z.number().int().optional(),
  }),

  // Budget schemas
  setBudget: z.object({
    workspaceId: z.number().int().positive(),
    monthlyLimitUsd: z.string().regex(/^\d+(\.\d{1,2})?$/),
  }),

  // Postman import schemas
  importPostman: z.object({
    workspaceId: z.number().int().positive(),
    collectionJson: z.any(),
  }),

  // AgentGuard schemas
  trackAgent: z.object({
    workspaceId: z.number().int().positive(),
    agentId: z.string().min(1),
    costUsd: z.number().min(0),
  }),

  killAgent: z.object({
    workspaceId: z.number().int().positive(),
    agentId: z.string().min(1),
    reason: z.string().optional(),
  }),
};

// ─────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────

export const ErrorCodes = {
  NOT_FOUND: "RESOURCE_NOT_FOUND",
  ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  PLAN_LIMIT_EXCEEDED: "PLAN_LIMIT_EXCEEDED",
  SUBSCRIPTION_REQUIRED: "SUBSCRIPTION_REQUIRED",
  INVALID_API_KEY: "INVALID_API_KEY",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

// Helper to throw specific errors
export function throwNotFound(resource: string) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `${resource} not found`,
  });
}

export function throwForbidden(message?: string) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: message || "You don't have permission to perform this action",
  });
}

export function throwBadRequest(message: string) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message,
  });
}

export function throwUnauthorized(message?: string) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: message || "Authentication required",
  });
}
