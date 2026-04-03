import React from 'react';
import { trpc } from './utils/trpc';
import { AlertTriangle, TrendingUp, DollarSign, Brain, Zap, ArrowUpRight } from 'lucide-center';

export const CostsPage: React.FC = () => {
  const { data: summary, isLoading } = trpc.llmCost.getSummary.useQuery({ period: 'month' });
  const { data: featureCosts } = trpc.llmCost.getCostByFeature.useQuery({ period: 'month' });

  // FIX 8 — Cost Revelation Moment on First Dashboard Load
  const topEndpoint = featureCosts && featureCosts.length > 0 
    ? featureCosts.reduce((prev, current) => (prev.cost > current.cost) ? prev : current)
    : null;
  
  const totalSpend = featureCosts?.reduce((sum, item) => sum + item.cost, 0) || 0;
  const topEndpointPercentage = totalSpend > 0 ? (topEndpoint?.cost || 0) / totalSpend * 100 : 0;
  const showCostAlert = topEndpointPercentage > 40;

  if (isLoading) return <div className="p-10">Loading costs...</div>;

  return (
    <div className="p-10 space-y-10 bg-gray-50 min-h-screen max-w-7xl mx-auto">
      {/* FIX 8 — Cost Revelation Banner */}
      {showCostAlert && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-8 flex items-start gap-6 shadow-xl shadow-amber-100 animate-in slide-in-from-top duration-700">
          <div className="p-4 bg-amber-100 rounded-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-600" />
          </div>
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-amber-900">⚡ Cost Alert</h2>
              <p className="text-amber-800 text-lg font-medium leading-relaxed">
                Your <span className="font-black underline decoration-amber-400 decoration-4">[{topEndpoint?.name}]</span> endpoint accounts for <span className="font-black">{topEndpointPercentage.toFixed(1)}%</span> of your total LLM bill this month. You may be over-optimizing the wrong feature.
              </p>
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200">
                Optimize Now
              </button>
              <button className="px-6 py-2.5 bg-white text-amber-800 border border-amber-200 rounded-xl font-bold hover:bg-amber-50 transition-all">
                View Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-gray-900">LLM Cost Intelligence</h1>
          <p className="text-gray-500 font-medium">Detailed breakdown of your AI infrastructure spend.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
            Download CSV
          </button>
          <button className="px-6 py-3 bg-[#1d4ed8] text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-50 rounded-xl">
              <DollarSign className="w-6 h-6 text-[#1d4ed8]" />
            </div>
            <div className="flex items-center gap-1 text-green-600 font-bold text-sm bg-green-50 px-2 py-1 rounded-lg">
              <TrendingUp className="w-4 h-4" /> +12%
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Monthly Spend</p>
            <p className="text-4xl font-black text-gray-900">₹{totalSpend.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Thinking Tokens Cost</p>
            <p className="text-4xl font-black text-purple-600">₹{(totalSpend * 0.23).toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-50 rounded-xl">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Endpoints</p>
            <p className="text-4xl font-black text-gray-900">{featureCosts?.length || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-xl font-black text-gray-900">Spend by Endpoint</h3>
          <span className="text-sm font-bold text-gray-400">LAST 30 DAYS</span>
        </div>
        <div className="divide-y divide-gray-50">
          {featureCosts?.map((item, i) => (
            <div key={i} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-300 group-hover:bg-[#1d4ed8] group-hover:text-white transition-all">
                  {i + 1}
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-gray-900">{item.name}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#1d4ed8] h-full rounded-full" 
                        style={{ width: `${(item.cost / totalSpend) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {((item.cost / totalSpend) * 100).toFixed(0)}% of total
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xl font-black text-gray-900">₹{item.cost.toFixed(2)}</p>
                <div className="flex items-center gap-1 text-[#1d4ed8] text-xs font-bold uppercase tracking-widest cursor-pointer opacity-0 group-hover:opacity-100 transition-all">
                  Optimize <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
