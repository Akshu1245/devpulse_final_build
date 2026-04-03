/**
 * DevPulse OpenAPI / Swagger Spec Generator
 * ==========================================
 * Generates OpenAPI 3.0 spec from the tRPC router definitions.
 * Served at GET /docs and GET /openapi.json
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "DevPulse API",
    version: "1.0.0",
    description:
      "API Security Intelligence + LLM Cost Tracking platform. " +
      "Provides OWASP scanning, thinking token attribution, AgentGuard kill switch, " +
      "shadow API detection, and PCI DSS compliance reporting.",
    contact: {
      name: "DevPulse Support",
      url: "https://devpulse.io",
    },
  },
  servers: [
    { url: "http://localhost:3000", description: "Local Development" },
    { url: "https://api.devpulse.io", description: "Production" },
  ],
  tags: [
    { name: "System", description: "Health checks and system info" },
    { name: "Auth", description: "Authentication and session management" },
    { name: "Scans", description: "API security scanning endpoints" },
    { name: "Vulnerabilities", description: "Vulnerability management" },
    { name: "LLM Costs", description: "LLM cost tracking and analytics" },
    { name: "AgentGuard", description: "Autonomous agent monitoring and kill switch" },
    { name: "Shadow API", description: "Shadow API discovery and whitelisting" },
    { name: "Compliance", description: "PCI DSS v4.0 and GDPR compliance reports" },
    { name: "Postman", description: "Postman collection import and scanning" },
    { name: "Billing", description: "Stripe subscription management" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from the VS Code extension or login endpoint",
      },
    },
    schemas: {
      Severity: {
        type: "string",
        enum: ["critical", "high", "medium", "low", "info"],
      },
      RiskTier: {
        type: "string",
        enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "HEALTHY"],
      },
      Vulnerability: {
        type: "object",
        properties: {
          id: { type: "integer" },
          endpoint: { type: "string" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
          severity: { $ref: "#/components/schemas/Severity" },
          category: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          cwe: { type: "string" },
          cvss: { type: "string" },
          recommendation: { type: "string" },
          status: { type: "string", enum: ["open", "acknowledged", "resolved", "wontfix"] },
        },
      },
      UnifiedRiskScore: {
        type: "object",
        properties: {
          workspaceId: { type: "integer" },
          unifiedScore: { type: "number", minimum: 0, maximum: 100 },
          riskTier: { $ref: "#/components/schemas/RiskTier" },
          securityScore: { type: "number" },
          costScore: { type: "number" },
          breakdown: { type: "object" },
          recommendations: { type: "array", items: { type: "string" } },
        },
      },
      LLMCostEvent: {
        type: "object",
        properties: {
          provider: { type: "string" },
          model: { type: "string" },
          promptTokens: { type: "integer" },
          completionTokens: { type: "integer" },
          thinkingTokens: { type: "integer" },
          costUsd: { type: "number" },
          featureName: { type: "string" },
          latencyMs: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: { description: "Server is healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, timestamp: { type: "string" } } } } } },
        },
      },
    },
    "/trpc/system.health": {
      get: {
        tags: ["System"],
        summary: "tRPC health check",
        responses: { 200: { description: "OK" } },
      },
    },
    "/trpc/unified.getOverallScore": {
      get: {
        tags: ["Scans"],
        summary: "Get unified risk score for a workspace",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "input", in: "query", required: true, schema: { type: "object", properties: { workspaceId: { type: "integer" } } } },
        ],
        responses: {
          200: { description: "Unified risk assessment", content: { "application/json": { schema: { $ref: "#/components/schemas/UnifiedRiskScore" } } } },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/trpc/llmCosts.track": {
      post: {
        tags: ["LLM Costs"],
        summary: "Track an LLM API call and its cost",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LLMCostEvent",
              },
            },
          },
        },
        responses: {
          200: { description: "Cost tracked successfully" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/trpc/agentGuard.killAgent": {
      post: {
        tags: ["AgentGuard"],
        summary: "Manually kill a rogue agent",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "agentId"],
                properties: {
                  workspaceId: { type: "integer" },
                  agentId: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Agent killed successfully", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, costSaved: { type: "number" } } } } } },
          401: { description: "Unauthorized" },
          404: { description: "Agent not found" },
        },
      },
    },
    "/trpc/postman.importCollection": {
      post: {
        tags: ["Postman"],
        summary: "Import a Postman collection and scan it for vulnerabilities",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["workspaceId", "collectionJson"],
                properties: {
                  workspaceId: { type: "integer" },
                  collectionJson: { type: "object", description: "Raw Postman collection JSON (v1, v2, or v2.1)" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Collection scanned",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    scanId: { type: "integer" },
                    endpoints: { type: "integer" },
                    vulnerabilities: { type: "integer" },
                    exposedKeys: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * Swagger UI HTML page
 */
export function generateSwaggerPage(apiUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>DevPulse API Docs</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #0a0f1e; }
      .swagger-ui .topbar { background: #0f172a; border-bottom: 1px solid #1e293b; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      SwaggerUIBundle({
        url: "${apiUrl}/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: "BaseLayout",
        persistAuthorization: true,
      });
    </script>
  </body>
</html>`;
}
