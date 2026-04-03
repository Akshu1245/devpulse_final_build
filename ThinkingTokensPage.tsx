/**
 * Thinking Tokens Analytics Page
 * 
 * PHASE 5: Comprehensive thinking token cost tracking and analysis
 * 
 * Features:
 * - Total thinking token spend this month
 * - Model breakdown (which LLM models use thinking tokens)
 * - Feature breakdown (which features use most thinking tokens)
 * - Daily trend chart (improving or worsening?)
 * - Detection confidence (which costs are direct API vs estimated)
 * - Per-endpoint breakdown (NEW in PHASE 5)
 */

import React, { useState, useEffect } from 'react';

interface ThinkingTokenSummary {
  totalThinkingTokens: number;
  estimatedCostUsd: number;
  eventCount: number;
  modelsUsing: string[];
  percentOfTotalTokens: number;
  averagePerCall: number;
  topFeature: {
    feature: string;
    tokens: number;
    cost: number;
    percent: number;
  } | null;
}

interface ModelBreakdown {
  model: string;
  totalThinkingTokens: number;
  eventCount: number;
  estimatedCostUsd: number;
  averageThinkingTokensPerCall: number;
  percentOfTotalTokens: number;
  percentOfTotalCost: number;
}

interface FeatureBreakdown {
  featureName: string;
  endpointPath?: string;
  totalThinkingTokens: number;
  eventCount: number;
  estimatedCostUsd: number;
  averageThinkingTokensPerCall: number;
  models: string[];
  percentOfFeatureCost: number;
}

interface TrendPoint {
  date: string;
  totalThinkingTokens: number;
  costUsd: number;
  eventCount: number;
  detectionAccuracy: number;
  topModel: { model: string; tokens: number };
  topFeature: { feature: string; tokens: number };
}

/**
 * Thinking Tokens Analytics Dashboard
 */
export const ThinkingTokensPage: React.FC<{ workspaceId: number }> = ({ workspaceId }) => {
  const [summary, setSummary] = useState<ThinkingTokenSummary | null>(null);
  const [modelBreakdown, setModelBreakdown] = useState<ModelBreakdown[]>([]);
  const [featureBreakdown, setFeatureBreakdown] = useState<FeatureBreakdown[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'models' | 'features' | 'trend'>('summary');

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load summary
      const summaryRes = await fetch(`/api/trpc/thinkingTokens.getSummary?workspaceId=${workspaceId}`);
      const summaryData = await summaryRes.json();
      setSummary(summaryData.result?.data);

      // Load models
      const modelsRes = await fetch(`/api/trpc/thinkingTokens.getByModel?workspaceId=${workspaceId}`);
      const modelsData = await modelsRes.json();
      setModelBreakdown(modelsData.result?.data || []);

      // Load features
      const featuresRes = await fetch(`/api/trpc/thinkingTokens.getByFeatureEndpoint?workspaceId=${workspaceId}`);
      const featuresData = await featuresRes.json();
      setFeatureBreakdown(featuresData.result?.data || []);

      // Load trend
      const trendRes = await fetch(`/api/trpc/thinkingTokens.getTrend?workspaceId=${workspaceId}&days=30`);
      const trendData = await trendRes.json();
      setTrend(trendData.result?.data || []);
    } catch (error) {
      console.error('Failed to load thinking tokens data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading thinking token analytics...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">💭 Thinking Token Analytics</h1>
          <p className="text-slate-400">
            Track LLM reasoning token usage and costs across your workspace
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {/* Total Cost */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6">
              <div className="text-sm text-blue-100 mb-2">Thinking Token Cost</div>
              <div className="text-3xl font-bold">
                ${summary.estimatedCostUsd.toFixed(2)}
              </div>
              <div className="text-xs text-blue-100 mt-2">This month</div>
            </div>

            {/* Total Tokens */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6">
              <div className="text-sm text-purple-100 mb-2">Total Tokens</div>
              <div className="text-3xl font-bold">
                {(summary.totalThinkingTokens / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-purple-100 mt-2">
                {summary.percentOfTotalTokens.toFixed(1)}% of all tokens
              </div>
            </div>

            {/* Events */}
            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-6">
              <div className="text-sm text-cyan-100 mb-2">API Calls</div>
              <div className="text-3xl font-bold">{summary.eventCount.toLocaleString()}</div>
              <div className="text-xs text-cyan-100 mt-2">
                Avg {summary.averagePerCall.toLocaleString()} tokens/call
              </div>
            </div>

            {/* Models */}
            <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-lg p-6">
              <div className="text-sm text-violet-100 mb-2">Models Using</div>
              <div className="text-3xl font-bold">{summary.modelsUsing.length}</div>
              <div className="text-xs text-violet-100 mt-2">
                {summary.modelsUsing.join(', ') || 'None'}
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-3 px-4 font-semibold transition-colors ${
              activeTab === 'summary'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`pb-3 px-4 font-semibold transition-colors ${
              activeTab === 'models'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            By Model
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={`pb-3 px-4 font-semibold transition-colors ${
              activeTab === 'features'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            By Feature/Endpoint
          </button>
          <button
            onClick={() => setActiveTab('trend')}
            className={`pb-3 px-4 font-semibold transition-colors ${
              activeTab === 'trend'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Trend (30 Days)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'summary' && summary?.topFeature && (
          <div className="bg-slate-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Top Feature Using Thinking Tokens</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-slate-400">Feature</div>
                <div className="font-bold text-lg">{summary.topFeature.feature}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Tokens</div>
                <div className="font-bold text-lg">
                  {(summary.topFeature.tokens / 1000).toFixed(1)}K
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Cost</div>
                <div className="font-bold text-lg">${summary.topFeature.cost.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-slate-400">% of Total</div>
                <div className="font-bold text-lg">{summary.topFeature.percent.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-slate-300">Model</th>
                  <th className="px-6 py-3 text-right text-slate-300">Thinking Tokens</th>
                  <th className="px-6 py-3 text-right text-slate-300">Events</th>
                  <th className="px-6 py-3 text-right text-slate-300">Cost</th>
                  <th className="px-6 py-3 text-right text-slate-300">Avg/Call</th>
                  <th className="px-6 py-3 text-right text-slate-300">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {modelBreakdown.map((model, idx) => (
                  <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="px-6 py-3 font-semibold">{model.model}</td>
                    <td className="px-6 py-3 text-right">
                      {(model.totalThinkingTokens / 1000).toFixed(1)}K
                    </td>
                    <td className="px-6 py-3 text-right">{model.eventCount.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">${model.estimatedCostUsd.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">
                      {model.averageThinkingTokensPerCall.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold">
                      {model.percentOfTotalCost.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-slate-300">Feature / Endpoint</th>
                  <th className="px-6 py-3 text-right text-slate-300">Thinking Tokens</th>
                  <th className="px-6 py-3 text-right text-slate-300">Events</th>
                  <th className="px-6 py-3 text-right text-slate-300">Cost</th>
                  <th className="px-6 py-3 text-right text-slate-300">Models</th>
                </tr>
              </thead>
              <tbody>
                {featureBreakdown.map((feature, idx) => (
                  <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50">
                    <td className="px-6 py-3">
                      <div className="font-semibold">{feature.featureName}</div>
                      {feature.endpointPath && (
                        <div className="text-xs text-slate-400">{feature.endpointPath}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {(feature.totalThinkingTokens / 1000).toFixed(1)}K
                    </td>
                    <td className="px-6 py-3 text-right">{feature.eventCount.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right">${feature.estimatedCostUsd.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right text-xs">
                      {feature.models.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'trend' && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">30-Day Trend</h2>
            <div className="space-y-3">
              {trend.slice(-7).map((point, idx) => (
                <div key={idx} className="flex items-center gap-4 pb-3 border-b border-slate-700 last:border-b-0">
                  <div className="w-20 text-sm font-semibold text-slate-400">{point.date}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm">
                        {(point.totalThinkingTokens / 1000).toFixed(1)}K tokens
                      </span>
                      <span className="text-sm font-semibold">${point.costUsd.toFixed(2)}</span>
                    </div>
                    <div
                      className="h-2 bg-purple-500 rounded"
                      style={{
                        width: `${Math.min(100, (point.totalThinkingTokens / 5000) * 100)}%`,
                      }}
                    />
                    <div className="flex justify-between mt-2 text-xs text-slate-400">
                      <span>
                        🏆 {point.topFeature.feature} ({(point.topFeature.tokens / 1000).toFixed(1)}K)
                      </span>
                      <span>
                        📊 {point.detectionAccuracy}% direct API
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h3 className="font-semibold mb-2">ℹ️ About Thinking Tokens</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>
              • <strong>Direct API:</strong> 100% accurate (models: o1, o3, claude-3-7-sonnet)
            </li>
            <li>
              • <strong>Timing Estimate:</strong> ~70% accurate, ±25% variance for other models
            </li>
            <li>
              • <strong>Cost:</strong> Varies by model (o1: $0.000015/token, claude: $0.000003/token)
            </li>
            <li>
              • <strong>Percentage:</strong> Thinking tokens as % of all tokens for this workspace
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ThinkingTokensPage;
