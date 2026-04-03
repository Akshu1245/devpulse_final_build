/**
 * ShadowApisPage - Shadow API Detection Dashboard (PHASE 7)
 * ===========================================================
 * Displays detected undocumented, expensive, and suspicious API endpoints
 * with risk scoring and whitelist management
 */

import React, { useState } from "react";
import { trpc } from "../utils/trpc";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  TrendingUp,
  Target,
  Shield,
  Zap,
  Trash2,
  Download,
} from "lucide-react";

interface ShadowApi {
  endpoint: string;
  method: string;
  callCount: number;
  totalCost: number;
  avgLatencyMs: number;
  thinkingTokensUsed: number;
  modelsUsed: string[];
  riskScore: number;
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  riskFactors: string[];
  detectionReason: string;
  firstSeen: number;
  isWhitelisted: boolean;
}

export const ShadowApisPage: React.FC<{ workspaceId: number }> = ({
  workspaceId,
}) => {
  // Query data
  const detectQuery = trpc.shadowApi.detect.useQuery({ workspaceId }, { refetchInterval: 60000 });
  const summaryQuery = trpc.shadowApi.getSummary.useQuery({ workspaceId }, { refetchInterval: 60000 });
  
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [showWhitelisted, setShowWhitelisted] = useState(false);

  const shadowApis = (detectQuery.data || []) as ShadowApi[];
  const summary = summaryQuery.data;

  const filteredApis = showWhitelisted ? shadowApis : shadowApis.filter((a) => !a.isWhitelisted);

  const getRiskColor = (tier: string) => {
    switch (tier) {
      case "CRITICAL":
        return "bg-red-50 border-red-200 text-red-700";
      case "HIGH":
        return "bg-orange-50 border-orange-200 text-orange-700";
      case "MEDIUM":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "LOW":
        return "bg-blue-50 border-blue-200 text-blue-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const getRiskBadge = (tier: string) => {
    switch (tier) {
      case "CRITICAL":
        return "🔴";
      case "HIGH":
        return "🟠";
      case "MEDIUM":
        return "🟡";
      case "LOW":
        return "🔵";
      default:
        return "⚪";
    }
  };

  if (detectQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Analyzing API usage...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🕵️ Shadow API Detection</h1>
          <p className="text-gray-500">Identify undocumented and suspicious API endpoints (PHASE 7)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowWhitelisted(!showWhitelisted)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            {showWhitelisted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showWhitelisted ? "Showing" : "Hiding"} Whitelisted
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Total Shadow APIs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Shadow APIs</p>
                <p className="text-3xl font-bold text-gray-900">{summary.totalShadowApis}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-400 opacity-20" />
            </div>
          </div>

          {/* Critical */}
          <div className="bg-red-50 rounded-lg border border-red-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-700 text-sm font-medium">Critical</p>
                <p className="text-3xl font-bold text-red-700">{summary.criticalCount}</p>
              </div>
              <div className="text-3xl">🔴</div>
            </div>
          </div>

          {/* High Risk */}
          <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-700 text-sm font-medium">High Risk</p>
                <p className="text-3xl font-bold text-orange-700">{summary.highCount}</p>
              </div>
              <div className="text-3xl">🟠</div>
            </div>
          </div>

          {/* Unauthorized Cost */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-700 text-sm font-medium">Unknown Cost</p>
                <p className="text-3xl font-bold text-yellow-700">${summary.totalUnauthorizedCost.toFixed(2)}</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400 opacity-20" />
            </div>
          </div>

          {/* Thinking Tokens */}
          <div className="bg-purple-50 rounded-lg border border-purple-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-700 text-sm font-medium">Expensive Thinking</p>
                <p className="text-2xl font-bold text-purple-700">
                  {summary.topRiskEndpoints
                    .filter((a) => a.thinkingTokensUsed > 5000)
                    .length} endpoints
                </p>
              </div>
              <div className="text-3xl">💭</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shadow APIs Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Detected Shadow APIs
          </h2>

          {filteredApis.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
              <p className="text-gray-500">No shadow APIs detected</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {filteredApis.map((api, idx) => (
                <div
                  key={idx}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${getRiskColor(api.riskTier)} ${
                    expandedEndpoint === api.endpoint ? "ring-2 ring-offset-2 ring-blue-400" : ""
                  }`}
                  onClick={() =>
                    setExpandedEndpoint(
                      expandedEndpoint === api.endpoint ? null : api.endpoint
                    )
                  }
                >
                  {/* Summary Row */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getRiskBadge(api.riskTier)}</span>
                        <div>
                          <p className="font-semibold">
                            {api.method} {api.endpoint}
                          </p>
                          <p className="text-xs opacity-75">
                            {api.callCount} calls • ${api.totalCost.toFixed(2)} • {api.avgLatencyMs}ms
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{api.riskScore.toFixed(0)}</p>
                      <p className="text-xs opacity-75">risk</p>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedEndpoint === api.endpoint && (
                    <div className="mt-4 pt-4 border-t-2 border-opacity-20 space-y-2">
                      <div>
                        <p className="text-xs font-semibold opacity-75 uppercase">Detection Reason</p>
                        <p className="text-sm">{api.detectionReason.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold opacity-75 uppercase">Risk Factors</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {api.riskFactors.map((factor, i) => (
                            <span key={i} className="text-xs bg-black bg-opacity-10 px-2 py-1 rounded">
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold opacity-75 uppercase">Models Used</p>
                        <p className="text-sm">{api.modelsUsed.join(", ")}</p>
                      </div>
                      {api.thinkingTokensUsed > 0 && (
                        <div>
                          <p className="text-xs font-semibold opacity-75 uppercase">Thinking Tokens</p>
                          <p className="text-sm">{api.thinkingTokensUsed} tokens</p>
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <button className="flex-1 px-3 py-2 text-xs bg-black bg-opacity-10 rounded hover:bg-opacity-20 transition-all flex items-center justify-center gap-1">
                          <EyeOff className="w-3 h-3" /> Whitelist
                        </button>
                        <button className="flex-1 px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-all flex items-center justify-center gap-1">
                          <Trash2 className="w-3 h-3" /> Block
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Trending Endpoints */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            By Activity
          </h2>

          {summary?.trendingEndpoints && summary.trendingEndpoints.length > 0 ? (
            <div className="space-y-3">
              {summary.trendingEndpoints.slice(0, 8).map((api, idx) => (
                <div key={idx} className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                  <p className="font-semibold text-sm truncate">{api.endpoint}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{api.callCount} calls</span>
                    <span className="text-xs font-bold">{api.riskScore}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div
                      className={`h-1.5 rounded-full ${
                        api.riskScore >= 80
                          ? "bg-red-600"
                          : api.riskScore >= 60
                          ? "bg-orange-600"
                          : api.riskScore >= 40
                          ? "bg-yellow-600"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${api.riskScore}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No activity data</p>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p>
          💡 <strong>PHASE 7 Enhancement:</strong> Shadow API Detection identifies undocumented endpoints by
          comparing actual API calls (from logs) with documented endpoints (from Postman). Risk scores are calculated
          based on thinking token usage, latency, call volume, and model selection. Suspicious patterns are flagged
          for security review.
        </p>
      </div>
    </div>
  );
};
