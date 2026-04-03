/**
 * Client-side tRPC Setup
 * ======================
 * React Query hooks for all backend procedures.
 */

import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "../routers";

// ─────────────────────────────────────────────────────────────────────────
// CREATE TRPC CLIENT
// ─────────────────────────────────────────────────────────────────────────

export const trpc = createTRPCReact<AppRouter>();

// ─────────────────────────────────────────────────────────────────────────
// HTTP LINK CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

// Access Vite environment variables safely
declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
  }
}

export function createTrpcClient(apiUrl?: string) {
  // Use passed URL, or VITE_API_URL env var, or fallback to localhost
  const baseUrl = apiUrl || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || "http://localhost:3000";

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        headers() {
          // Get session from cookie/localStorage
          const session = localStorage.getItem("session") || "";
          return {
            Authorization: session ? `Bearer ${session}` : "",
          };
        },
      }),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────

export type { AppRouter };
