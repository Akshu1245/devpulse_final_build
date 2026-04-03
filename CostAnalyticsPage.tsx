import React from 'react';
import { trpc } from './utils/trpc';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Brain, TrendingUp, DollarSign, Zap } from 'lucide-react';
import { useAuth } from './_core/hooks/useAuth'; // Import useAuth

export const CostAnalyticsPage: React.FC = () => {
  const { user } = useAuth(); // Get user from auth context
  const { data: costTrend, isLoading } = trpc.llmCost.getDailyCostTrend.useQuery({ period: 'month' });
  const { data: summary } = trpc.llmCost.getSummary.useQuery({ period: 'month' });
  
  // INCOMPLETE FIX 2: Replace hardcoded thinkingCost with real tRPC query
  const { data: thinkingSummary } = trpc.llmCost.getThinkingTokenSummary.useQuery(
    { workspaceId: user?.activeWorkspaceId! }, 
    { enabled: !!user?.activeWorkspaceId }
  );

  if (isLoading) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">LLM Cost Intelligence</h1>
          <p className="text-gray-500">Track every token, including hidden reasoning costs.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Thinking Tokens</p>
              <p className="text-xl font-bold text-purple-700">₹{thinkingSummary?.totalThinkingCost.toFixed(2) || '0.00'} spent on hidden reasoning this month</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-[#1d4ed8]" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Spend</p>
              <p className="text-xl font-bold text-[#1d4ed8]">₹{summary?.totalCostUsd || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Daily Spend Trend</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costTrend}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorThinking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" />
                <Area 
                  type="monotone" 
                  dataKey="cost" 
                  name="Base Cost"
                  stroke="#1d4ed8" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCost)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="thinkingCost" 
                  name="Thinking Tokens"
                  stroke="#9333ea" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorThinking)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Top Features by Cost</h3>
            <div className="space-y-4">
              {/* Mocking feature list */}
              {['Search', 'Chatbot', 'Data Extraction'].map((feature, i) => (
                <div key={feature} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{feature}</span>
                    <span className="text-gray-500">₹{120 - i * 30}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-[#1d4ed8] h-full rounded-full" 
                      style={{ width: `${80 - i * 20}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#1d4ed8] to-blue-600 p-6 rounded-2xl shadow-lg text-white">
            <Zap className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="text-lg font-bold mb-2">Cost Optimization Tip</h3>
            <p className="text-blue-100 text-sm mb-4">
              Your "Thinking Tokens" spend on GPT-4o-preview is up 23% this week. Consider switching to GPT-4o-mini for simple reasoning tasks.
            </p>
            <button className="w-full py-2 bg-white text-[#1d4ed8] rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors">
              Apply Recommendation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
