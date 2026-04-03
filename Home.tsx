// @ts-nocheck
import React, { useMemo } from 'react';
import { trpc } from './utils/trpc';
import {
  Shield, Zap, Import, Settings, ArrowRight,
  AlertTriangle, DollarSign, Bot, Activity,
  CheckCircle2, Clock, Download, Skull, TrendingUp
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────
function relativeTime(date: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), 'second');
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  scan_completed:     { icon: Shield,        color: 'text-blue-600',  bg: 'bg-blue-100'  },
  vulnerability_found:{ icon: AlertTriangle, color: 'text-red-600',   bg: 'bg-red-100'   },
  cost_spike:         { icon: Zap,           color: 'text-amber-600', bg: 'bg-amber-100' },
  agent_killed:       { icon: Skull,         color: 'text-red-600',   bg: 'bg-red-100'   },
  postman_import:     { icon: Download,      color: 'text-green-600', bg: 'bg-green-100' },
};

function StatSkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="w-9 h-9 bg-gray-100 rounded-lg" />
        <div className="w-16 h-4 bg-gray-100 rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-24 h-3 bg-gray-100 rounded" />
        <div className="w-16 h-7 bg-gray-100 rounded" />
        <div className="w-32 h-3 bg-gray-100 rounded" />
      </div>
    </div>
  );
}

// ─── main ───────────────────────────────────────────────────────────────────
export const Home: React.FC = () => {
  const { data: scanCount,      isLoading: l1 } = trpc.scan.count.useQuery({ workspaceId: 1 });
  const { data: criticalCount,  isLoading: l2 } = trpc.security.criticalCount.useQuery({ workspaceId: 1 });
  const { data: monthlySpend,   isLoading: l3 } = trpc.llmCost.monthlyTotal.useQuery({ workspaceId: 1 });
  const { data: agentCount,     isLoading: l4 } = trpc.agentGuard.activeCount.useQuery({ workspaceId: 1 });
  const { data: recentActivity, isLoading: l5 } = trpc.activity.getRecent.useQuery({ workspaceId: 1, limit: 10 });

  const isLoading = l1 || l2 || l3 || l4 || l5;
  const isNewUser = !isLoading && (scanCount?.total === 0);

  const hasCritical = (criticalCount?.count ?? 0) > 0;

  const stats = useMemo(() => [
    {
      label: 'APIs Scanned',
      value: String(scanCount?.total ?? 0),
      sub: 'Total endpoints scanned',
      icon: Shield,
      accent: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Critical Vulnerabilities',
      value: String(criticalCount?.count ?? 0),
      sub: hasCritical ? 'Action required now' : 'All clear ✓',
      icon: AlertTriangle,
      accent: hasCritical ? 'text-red-600' : 'text-green-600',
      bg: hasCritical ? 'bg-red-50' : 'bg-green-50',
    },
    {
      label: 'LLM Spend This Month',
      value: `₹${(monthlySpend?.totalInr ?? 0).toFixed(2)}`,
      sub: `$${(monthlySpend?.totalUsd ?? 0).toFixed(2)} USD`,
      icon: DollarSign,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Agents Protected',
      value: String(agentCount?.count ?? 0),
      sub: 'AgentGuard monitoring active',
      icon: Bot,
      accent: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ], [scanCount, criticalCount, monthlySpend, agentCount, hasCritical]);

  return (
    <div className="p-10 space-y-10 bg-gray-50 min-h-screen max-w-7xl mx-auto">

      {/* ── Onboarding Banner ──────────────────────────── */}
      {isNewUser && (
        <div className="relative overflow-hidden bg-gradient-to-r from-[#1d4ed8] to-blue-500 rounded-3xl p-10 text-white shadow-2xl shadow-blue-200">
          <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
            <Shield className="w-64 h-64" />
          </div>
          <div className="relative z-10 space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider">
                <Zap className="w-4 h-4 fill-current" />
                Zero Scans Found
              </div>
              <h1 className="text-4xl font-black leading-tight max-w-2xl">
                👋 Welcome to DevPulse. Import your Postman collection to get your first security scan in 60 seconds.
              </h1>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href="/security?import=postman"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#1d4ed8] rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg"
              >
                <Import className="w-5 h-5" />
                Import Postman Collection
              </a>
              <button className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 text-white border border-white/30 rounded-xl font-bold hover:bg-white/30 transition-all">
                <Settings className="w-5 h-5" />
                Connect API Proxy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-black text-gray-900">Dashboard</h2>
          <div className="h-px flex-1 bg-gray-200" />
          {!isLoading && (
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" /> Live
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
            : stats.map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-2 ${stat.bg} rounded-lg`}>
                      <stat.icon className={`w-5 h-5 ${stat.accent}`} />
                    </div>
                    <TrendingUp className="w-4 h-4 text-gray-200" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                    <p className={`text-2xl font-black ${stat.accent}`}>{stat.value}</p>
                    <p className="text-xs text-gray-400 font-medium">{stat.sub}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* ── Recent Activity ─────────────────────────────── */}
      {!isNewUser && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-5 h-5 text-[#1d4ed8]" />
            <h2 className="text-2xl font-black text-gray-900">Recent Activity</h2>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {l5 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 bg-gray-100 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-48 h-3 bg-gray-100 rounded" />
                    <div className="w-72 h-3 bg-gray-100 rounded" />
                  </div>
                  <div className="w-16 h-3 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : recentActivity?.events && recentActivity.events.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {recentActivity.events.map((event: any, i: number) => {
                const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG['scan_completed'];
                const Icon = cfg.icon;
                return (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                    <div className={`p-2 rounded-full ${cfg.bg} shrink-0`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
                      {event.description && (
                        <p className="text-xs text-gray-500 truncate">{event.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 font-medium whitespace-nowrap">
                      {relativeTime(event.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No activity yet.</p>
              <p className="text-gray-400 text-sm mt-1">Import a Postman collection to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* ── How DevPulse Works ──────────────────────────── */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-gray-900">How DevPulse Works</h2>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Import your APIs',                 desc: 'Postman / OpenAPI / Bruno. We map your entire attack surface in seconds.',                              icon: Import       },
            { step: '2', title: 'Get instant security + cost scan', desc: 'Identify OWASP Top 10 vulnerabilities and see exactly where your LLM budget goes.',                     icon: Shield       },
            { step: '3', title: 'AgentGuard protects you 24/7',    desc: 'Autonomous monitoring that kills rogue agents and severs leaked API keys automatically.',                 icon: CheckCircle2 },
          ].map((item, i) => (
            <div key={i} className="group relative bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 transition-all duration-300">
              <div className="absolute -top-4 -left-4 w-10 h-10 bg-[#1d4ed8] text-white rounded-xl flex items-center justify-center font-black text-lg shadow-lg">
                {item.step}
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-8 h-8 text-[#1d4ed8]" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-4 flex items-center gap-2 text-[#1d4ed8] font-bold text-sm cursor-pointer group-hover:gap-4 transition-all duration-200">
                  Learn More <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Home;
