// @ts-nocheck
/**
 * Vercel Serverless Entry Point
 * =============================
 * Handles tRPC requests via Vercel's serverless fetch API
 * This is the entry point for Vercel deployment
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./routers";
import { createContext } from "./_core/trpc";

// ─── Health Check Handler ─────────────────────────────────────
async function handleHealth(req: Request): Promise<Response> {
  const healthData = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "devpulse-api",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    vercel: process.env.VERCEL === "1",
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

// ─── Main tRPC Handler ────────────────────────────────────────
async function handleTrpc(req: Request): Promise<Response> {
  try {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: req,
      router: appRouter,
      createContext: createContext,
      onError: ({ error, path }: { error: any; path: any }) => {
        if (error.code !== "NOT_FOUND") {
          console.error(`[tRPC] Error on ${path}:`, error);
        }
      },
    });

    return response;
  } catch (error: any) {
    console.error("[API] Unhandled error in tRPC handler:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error?.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ─── Request Router ───────────────────────────────────────────
async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // Health endpoints (no auth required)
    if (path === "/health" || path === "/api/health") {
      return handleHealth(req);
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-agent-id, x-workspace-id",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // tRPC API
    if (path.startsWith("/api/trpc") || path.startsWith("/trpc")) {
      return handleTrpc(req);
    }

    // OpenAPI spec - lazy load to avoid build issues
    if (path === "/openapi.json") {
      try {
        const { openApiSpec } = await import("./_core/openapi");
        return new Response(JSON.stringify(openApiSpec), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "OpenAPI spec unavailable" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Not found
    return new Response(JSON.stringify({ error: "Not found", path }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[API] Unhandled error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error?.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Export for Vercel serverless
export default handler;
