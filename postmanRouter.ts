import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { PostmanParser, endpointsToScanItems, generateSecurityRecommendations, type ParsedCollection } from "./_core/postmanParser";
import { createScan, createVulnerability } from "./db";
import { enqueueScan } from "./_workers/queues/scanQueue";
import { enqueueNotification } from "./_services/notifications";
import { cacheWorkspaceVulnerabilities } from "./_cache/strategies/vulnCache";
import { invalidateUnifiedRiskScore } from "./_cache/strategies/unifiedScoreCache";

export const postmanRouter = router({
  /**
   * Import and parse Postman collection
   * Supports:
   * - v1.0, v2.0, and v2.1 collection formats
   * - Nested folders
   * - Multiple auth types
   * - Environment variables
   * - Secret detection
   * - Automatic scan generation
   */
  importCollection: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        fileName: z.string().max(255).optional(),
        mimeType: z.enum(["application/json", "text/json"]).optional(),
        fileSizeBytes: z.number().int().positive().max(50 * 1024 * 1024).optional(),
        // SECURITY: Validate collection size and structure
        collectionJson: z.union([
          z.string().max(50 * 1024 * 1024, "Collection must be under 50MB"),
          z.record(z.any()).refine(
            (obj: Record<string, unknown>) => JSON.stringify(obj).length <= 50 * 1024 * 1024,
            { message: "Collection must be under 50MB" }
          ),
        ]).transform((val: unknown, ctx: z.RefinementCtx) => {
          // Parse if string
          let parsed: any;
          if (typeof val === 'string') {
            try {
              parsed = JSON.parse(val);
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'collectionJson must be valid JSON',
              });
              return z.NEVER;
            }
          } else {
            parsed = val;
          }

          if (!parsed || typeof parsed !== 'object') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'collectionJson must be a JSON object',
            });
            return z.NEVER;
          }

          // Basic Postman collection shape guard
          const infoName = parsed?.info?.name;
          if (typeof infoName !== 'string' || !infoName.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Postman collection must include info.name',
            });
            return z.NEVER;
          }

          const hasItems = Array.isArray(parsed.item) && parsed.item.length > 0;
          if (!hasItems) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Postman collection must include at least one item',
            });
            return z.NEVER;
          }
          
          // Check nesting depth to prevent DoS
          const getDepth = (obj: any, depth = 0): number => {
            if (depth > 15) return depth; // Hard limit
            if (typeof obj !== 'object' || obj === null) return depth;
            return Math.max(...Object.values(obj).map(v => getDepth(v, depth + 1)), depth);
          };
          
          const maxDepth = getDepth(parsed);
          if (maxDepth > 10) {
            throw new Error(`Collection nesting too deep (${maxDepth} levels). Maximum allowed: 10`);
          }
          
          return parsed;
        }),
        autoScan: z.boolean().optional().default(true),
        baseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`[Postman] Importing collection for workspace ${input.workspaceId}`);

        if (input.fileName && !input.fileName.toLowerCase().endsWith('.json')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Only .json Postman collection files are supported',
          });
        }
        if (input.mimeType && !['application/json', 'text/json'].includes(input.mimeType)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid file type: ${input.mimeType}`,
          });
        }
        if (input.fileSizeBytes && input.fileSizeBytes > 50 * 1024 * 1024) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Collection file exceeds 50MB limit',
          });
        }

        // Quick parse for fast validation and response
        const collectionJsonString = typeof input.collectionJson === 'string' 
          ? input.collectionJson 
          : JSON.stringify(input.collectionJson);
        const quickParse = PostmanParser.quickParse(collectionJsonString);
        
        if (!quickParse.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid Postman collection: ${quickParse.error}`,
          });
        }

        console.log(`[Postman] Quick validated: ${quickParse.totalEndpoints} endpoints in collection "${quickParse.name}"`);

        // Parse collection using enhanced parser
        const parsed = PostmanParser.parse(input.collectionJson);

        console.log(`[Postman] Found ${parsed.totalEndpoints} endpoints`);
        console.log(`[Postman] Found ${parsed.exposedSecrets.length} secret types`);
        console.log(`[Postman] Auth types: ${parsed.authTypes.join(', ')}`);

        // Create scan
        const scanResult = await createScan(
          input.workspaceId,
          undefined,
          ctx.user?.id,
          parsed.totalEndpoints
        );

        if (!scanResult) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create scan',
          });
        }

        const scanId = scanResult.insertId;

        // Store endpoint-specific vulnerabilities
        const vulnerabilities: any[] = [];

        // 1. Secret exposure vulnerabilities
        for (const secret of parsed.exposedSecrets) {
          if (secret.count > 0) {
            const vuln = {
              endpoint: 'COLLECTION',
              method: 'ANALYSIS',
              severity: 'critical' as const,
              category: 'SECRET_EXPOSURE',
              title: `${secret.count} × ${secret.type} Found in Collection`,
              description: `Credentials or secrets detected in Postman collection: ${secret.locations.join(', ')}`,
              cwe: 'CWE-798',
              recommendation: 'Remove all credentials from collections. Use environment variables or secure storage instead.',
            };

            vulnerabilities.push(vuln);
            await createVulnerability(scanId, input.workspaceId, vuln);
          }
        }

        // 2. Authentication configuration issues
        const noAuthEndpoints = parsed.endpoints.filter((ep) => !ep.auth).length;
        if (noAuthEndpoints > 0) {
          const vuln: {
            endpoint: string;
            method: string;
            severity: "critical" | "high" | "medium" | "low" | "info";
            category: string;
            title: string;
            description: string;
            cwe: string;
            recommendation: string;
          } = {
            endpoint: 'COLLECTION',
            method: 'ANALYSIS',
            severity: noAuthEndpoints > parsed.totalEndpoints * 0.5 ? 'high' : 'medium',
            category: 'MISSING_AUTH',
            title: `${noAuthEndpoints} Endpoints Lack Authentication`,
            description: `${noAuthEndpoints} out of ${parsed.totalEndpoints} endpoints do not specify authentication.`,
            cwe: 'CWE-306',
            recommendation: 'Verify these are intentionally public. Add authentication to protected endpoints.',
          };

          vulnerabilities.push(vuln);
          await createVulnerability(scanId, input.workspaceId, vuln);
        }

        // 3. Per-endpoint security analysis
        for (const endpoint of parsed.endpoints) {
          // 3a: Broken Object Level Authorization (BOLA) detection
          if (endpoint.path.match(/\/\{?id\}?$|\/\{?\d+\}?/)) {
            const vuln = {
              endpoint: endpoint.path,
              method: endpoint.method,
              severity: 'high' as const,
              category: 'BOLA',
              title: 'Potential BOLA Vulnerability',
              description: `Endpoint uses direct object references (${endpoint.path}). Verify authorization checks are in place.`,
              cwe: 'CWE-639',
              recommendation: 'Implement object-level authorization checks. Verify users can only access their own resources.',
            };

            vulnerabilities.push(vuln);
            await createVulnerability(scanId, input.workspaceId, vuln);
          }

          // 3b: Excessive data exposure
          if (endpoint.method === 'GET' && (endpoint.path.includes('user') || endpoint.path.includes('data'))) {
            const vuln = {
              endpoint: endpoint.path,
              method: endpoint.method,
              severity: 'medium' as const,
              category: 'EXCESSIVE_DATA',
              title: 'Potential Excessive Data Exposure',
              description: `GET endpoint may expose more data than necessary (${endpoint.path}).`,
              cwe: 'CWE-200',
              recommendation: 'Implement field-level filtering and use DTOs to limit response data.',
            };

            vulnerabilities.push(vuln);
            await createVulnerability(scanId, input.workspaceId, vuln);
          }

          // 3c: Sensitive headers without authentication
          if (!endpoint.auth && endpoint.sensitiveHeaders.length > 0) {
            const vuln = {
              endpoint: endpoint.path,
              method: endpoint.method,
              severity: 'medium' as const,
              category: 'SENSITIVE_HEADERS',
              title: 'Sensitive Headers Without Authentication',
              description: `Endpoint expects sensitive headers (${endpoint.sensitiveHeaders.join(', ')}) but lacks authentication.`,
              cwe: 'CWE-200',
              recommendation: 'Implement authentication before accepting sensitive headers.',
            };

            vulnerabilities.push(vuln);
            await createVulnerability(scanId, input.workspaceId, vuln);
          }

          // 3d: Rate limiting missing
          if (!endpoint.auth && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(endpoint.method)) {
            const vuln = {
              endpoint: endpoint.path,
              method: endpoint.method,
              severity: 'low' as const,
              category: 'RATE_LIMIT',
              title: 'Missing Rate Limiting',
              description: `Unauthenticated ${endpoint.method} endpoint vulnerable to abuse.`,
              cwe: 'CWE-770',
              recommendation: 'Implement rate limiting on all publicly accessible endpoints.',
            };

            vulnerabilities.push(vuln);
            await createVulnerability(scanId, input.workspaceId, vuln);
          }

          // 3e: Detect query parameter injection risks
          if (endpoint.queryParams.length > 0) {
            const vuln = {
              endpoint: endpoint.path,
              method: endpoint.method,
              severity: 'medium' as const,
              category: 'QUERY_INJECTION',
              title: 'Query Parameters Present',
              description: `Endpoint accepts ${endpoint.queryParams.length} query parameters. Verify input validation.`,
              cwe: 'CWE-89',
              recommendation: 'Validate and sanitize all query parameters. Use parameterized queries.',
            };

            vulnerabilities.push(vuln);
            await createVulnerability(scanId, input.workspaceId, vuln);
          }
        }

        console.log(`[Postman] Created ${vulnerabilities.length} vulnerability findings`);

        // Cache vulnerabilities
        await cacheWorkspaceVulnerabilities(input.workspaceId, vulnerabilities);

        // PHASE 4: Invalidate unified risk score cache on vulnerability change
        await invalidateUnifiedRiskScore(input.workspaceId);

        // Generate recommendations
        const recommendations = generateSecurityRecommendations(parsed);

        // Auto-queue scan if enabled
        if (input.autoScan) {
          try {
            const scanItems = endpointsToScanItems(parsed.endpoints);
            const job = await enqueueScan({
              workspaceId: input.workspaceId.toString(),
              projectId: 'postman-import',
              apiEndpoint: input.baseUrl || 'https://api.example.com',
              method: 'POSTMAN_COLLECTION',
              body: { endpoints: scanItems },
            });

            console.log(`[Postman] Queued scan job ${job.id} with ${scanItems.length} endpoints`);

            // Notify user
            await enqueueNotification({
              type: 'websocket',
              workspaceId: input.workspaceId.toString(),
              userId: String(ctx.user?.id ?? ''),
              recipient: ctx.user?.email || 'admin@example.com',
              title: 'Postman Collection Imported',
              message: `Collection "${parsed.name}" imported with ${parsed.totalEndpoints} endpoints. Security scan queued.`,
              severity: parsed.exposedSecrets.length > 0 ? 'critical' : 'info',
              metadata: {
                scanId,
                jobId: job.id,
                endpointCount: parsed.totalEndpoints,
                secretCount: parsed.exposedSecrets.reduce((sum, s) => sum + s.count, 0),
              },
            });
          } catch (error) {
            console.error('[Postman] Auto-scan error:', error);
            // Continue even if auto-scan fails
          }
        }

        return {
          success: true,
          scanId,
          collection: {
            name: parsed.name,
            description: parsed.description,
            totalEndpoints: parsed.totalEndpoints,
          },
          findings: {
            vulnerabilityCount: vulnerabilities.length,
            criticalsFound: vulnerabilities.filter((v) => v.severity === 'critical').length,
            exposedSecrets: parsed.exposedSecrets,
            authTypes: parsed.authTypes,
            methods: parsed.methods,
            folders: parsed.folders.length,
          },
          recommendations,
          endpoints: parsed.endpoints.slice(0, 10), // Return first 10 for preview
          totalEndpointDetails: parsed.endpoints.length,
        };
      } catch (error) {
        console.error('[Postman] Import error:', error);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Failed to parse collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Get detailed endpoint analysis from parsed collection
   */
  getEndpointDetails: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        scanId: z.number(),
        endpointIndex: z.number(),
      })
    )
    .query(async ({ input }) => {
      // In production, would retrieve from cache/db
      // This is a placeholder for pagination
      return {
        endpoint: {
          name: 'Example Endpoint',
          method: 'GET',
          path: '/api/users',
        },
      };
    }),

  /**
   * Compare two Postman collections for API changes
   */
  compareCollections: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        collection1: z.any(),
        collection2: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      const parsed1 = PostmanParser.parse(input.collection1);
      const parsed2 = PostmanParser.parse(input.collection2);

      const endpoints1 = new Set(parsed1.endpoints.map((e) => `${e.method}:${e.path}`));
      const endpoints2 = new Set(parsed2.endpoints.map((e) => `${e.method}:${e.path}`));

      const added = Array.from(endpoints2).filter((e) => !endpoints1.has(e));
      const removed = Array.from(endpoints1).filter((e) => !endpoints2.has(e));
      const common = Array.from(endpoints1).filter((e) => endpoints2.has(e));

      return {
        added: added.length,
        removed: removed.length,
        common: common.length,
        breaking: removed.length > 0,
        newEndpoints: added,
        deprecatedEndpoints: removed,
      };
    }),
});
