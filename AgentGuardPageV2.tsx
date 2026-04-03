/**
 * AgentGuardPage - Dashboard for Agent Monitoring (PHASE 6)
 * ===========================================================
 * Real-time visualization of agent incidents, risk scores, and auto-kill decisions
 * Integrated with unified risk scoring from PHASE 4
 */

import React, { useState, useEffect, useCallback } from "react";
import { trpc } from "../utils/trpc";
import {
  AlertCircle,
  Skull,
  Zap,
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface Agent {
  id: string;
  workspaceId: number;
  totalCost: number;
  totalCalls: number;
  firstSeen: number;
  lastSeen: number;
  isKilled: boolean;
  killedAt?: number;
  killReason?: string;
}

interface Incident {
  id: number;
  workspaceId: number;
  agentId: string;
  action: string;
  reason?: string;
  costUsd: string;
  details?: string;
  timestamp: number;
}

export const AgentGuardPage: React.FC<{ workspaceId: number }> = ({
  workspaceId,
}) => {
  // Query data
  const dashboardQuery = trpc.agentGuard.getDashboardData.useQuery(
    { workspaceId },
    { refetchInterval: 5000 } // Refresh every 5 seconds
  );

  const alertHistoryQuery = trpc.agentGuard.getAlertHistory.useQuery(
    { workspaceId, limit: 20, offset: 0 },
    { refetchInterval: 10000 } // Refresh every 10 seconds
  );

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showAlertTimeline, setShowAlertTimeline] = useState(false);

  const stats = dashboardQuery.data?.stats;
  const activeAgents = dashboardQuery.data?.activeAgents || [];
  const recentInterventions = dashboardQuery.data?.recentInterventions || [];
  const alertHistory = alertHistoryQuery.data || [];

  // Calculate risk colors
  const getRiskColor = (tier?: string) => {
    switch (tier) {
      case "CRITICAL":
        return "text-red-600 bg-red-50 border-red-200";
      case "HIGH":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "MEDIUM":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "LOW":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "HEALTHY":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getRiskIndicator = (tier?: string) => {
    switch (tier) {
      case "CRITICAL":
        return "🔴";
      case "HIGH":
        return "🟠";
      case "MEDIUM":
        return "🟡";
      case "LOW":
        return "🔵";
      case "HEALTHY":
        return "🟢";
      default:
        return "⚪";
    }
  };

  if (dashboardQuery.isLoading) {
    return (
      <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading agent data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🛡️ AgentGuard</h1>
          <p className="text-gray-500">
            Autonomous agent monitoring with unified risk scoring (PHASE 6)
          </p>
        </div>
        <button
          onClick={() => setShowAlertTimeline(!showAlertTimeline)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Clock className="w-4 h-4" />
          Timeline
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Agents */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Agents</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalAgents || 0}
              </p>
            </div>
            <Activity className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
          <p className="text-gray-500 text-xs mt-2">
            {stats?.activeAgents || 0} active in last hour
          </p>
        </div>

        {/* Total Cost */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Today's Cost</p>
              <p className="text-3xl font-bold text-gray-900">
                ${stats?.totalCost?.toFixed(2) || "0.00"}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500 opacity-20" />
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Budget: ${stats?.budgetLimit?.toFixed(0) || "0"}/day
          </p>
        </div>

        {/* Risk Score */}
        <div className={`rounded-lg border p-6 ${getRiskColor(stats?.riskTier)}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Risk Score</p>
              <p className="text-3xl font-bold">
                {stats?.riskScore?.toFixed(0) || "0"}/100
              </p>
            </div>
            <AlertCircle className="w-8 h-8 opacity-20" />
          </div>
          <p className="text-xs mt-2 opacity-75">Tier: {stats?.riskTier || "UNKNOWN"}</p>
        </div>

        {/* Interventions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Auto-Kills Today
              </p>
              <p className="text-3xl font-bold text-red-600">
                {stats?.interventions || 0}
              </p>
            </div>
            <Skull className="w-8 h-8 text-red-500 opacity-20" />
          </div>
          <p className="text-gray-500 text-xs mt-2">
            Cost saved: $
            {recentInterventions
              .reduce(
                (sum, i) => sum + parseFloat(i.costUsd as string || "0"),
                0
              )
              .toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Agents List */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Active Agents
          </h2>

          {activeAgents.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
              <p className="text-gray-500">No active agents detected</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAgents.map((agent: Agent) => (
                <div
                  key={`${agent.agentId}`}
                  onClick={() => setSelectedAgent(agent.agentId)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedAgent === agent.agentId
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">
                        {agent.agentId}
                      </p>
                      <p className="text-sm text-gray-500">
                        {agent.totalCalls} calls • ${agent.totalCost.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        {Math.floor(
                          (Date.now() - agent.lastSeen) / 1000 / 60
                        )}{" "}
                        min ago
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Incidents */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Recent Incidents
          </h2>

          {recentInterventions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2 opacity-50" />
              <p className="text-gray-500 text-sm">No incidents today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInterventions.slice(0, 5).map((incident: Incident) => (
                <div
                  key={`${incident.agentId}-${incident.timestamp}`}
                  className="p-3 border border-red-200 bg-red-50 rounded-lg"
                >
                  <p className="font-semibold text-red-900 text-sm">
                    {incident.reason || incident.action}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {incident.agentId} •{" "}
                    {new Date(incident.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline View (Optional) */}
      {showAlertTimeline && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Alert Timeline (Last 24 Hours)
          </h2>

          <div className="space-y-2">
            {alertHistory.map((alert: Incident, idx: number) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="pt-1">
                  {alert.action === "killed" ? (
                    <Skull className="w-5 h-5 text-red-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">
                    Agent {alert.agentId} {alert.action}
                  </p>
                  <p className="text-sm text-gray-500">
                    {alert.reason || "No reason provided"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleString()} • Cost: $
                    {alert.costUsd}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
        <p>
          💡 <strong>PHASE 6 Enhancement:</strong> AgentGuard now integrates
          with unified risk scoring from PHASE 4. Risk tiers (CRITICAL/HIGH/
          MEDIUM/LOW/HEALTHY) are calculated based on cost overruns and incident
          history.{" "}
          <strong>Data refreshes every 5 seconds</strong> via real-time queries.
        </p>
      </div>
    </div>
  );
};
