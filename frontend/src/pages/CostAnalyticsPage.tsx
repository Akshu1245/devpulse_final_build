import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, Zap, BarChart3, ArrowUpRight } from 'lucide-react';
import { DEMO_COST_TREND, DEMO_COST_BY_FEATURE, DEMO_STATS, DEMO_THINKING_SUMMARY, DEMO_COST_BY_PROVIDER } from '../utils/demoData';
import { trpc } from '../utils/trpc';

export const CostAnalyticsPage: React.FC = () => {
  const { data } = trpc.llmCost.getBreakdown.useQuery({ workspaceId: 1 }, { enabled: false });
  const features = data?.byFeature ?? DEMO_COST_BY_FEATURE;
  const maxCost = Math.max(...features.map((f: any) => f.costUsd));

  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Header */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(34, 80%, 65%)', marginBottom: 6 }}>LLM Intelligence</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Cost Analytics</h1>
        <p style={{ color: 'var(--muted-foreground)', marginTop: 4 }}>Track and optimize LLM expenditure across all AI features and providers.</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'This Month', value: `$${DEMO_STATS.llmSpendUsd.toFixed(2)}`, sub: `₹${DEMO_STATS.llmSpendInr.toLocaleString()}`, icon: DollarSign, color: 'hsl(34, 80%, 65%)', glow: 'var(--glow-primary)' },
          { label: 'Thinking Tokens', value: `$${DEMO_THINKING_SUMMARY.estimatedCostUsd.toFixed(2)}`, sub: `${(DEMO_THINKING_SUMMARY.totalThinkingTokens / 1000).toFixed(0)}K tokens`, icon: Zap, color: 'hsl(195, 50%, 60%)', glow: 'var(--glow-secondary)' },
          { label: 'Total API Calls', value: features.reduce((s: number, f: any) => s + f.calls, 0).toLocaleString(), sub: 'Across all features', icon: BarChart3, color: 'hsl(160, 45%, 60%)', glow: 'var(--glow-accent)' },
          { label: 'Avg Cost/Call', value: `$${(DEMO_STATS.llmSpendUsd / features.reduce((s: number, f: any) => s + f.calls, 0)).toFixed(4)}`, sub: 'Per inference event', icon: TrendingUp, color: 'hsl(38, 75%, 65%)', glow: '0 0 20px hsl(38 75% 55% / 0.2)' },
        ].map((c, i) => (
          <div key={i} className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>{c.label}</p>
              <div style={{ padding: 8, background: `${c.color}22`, borderRadius: 8, boxShadow: c.glow }}>
                <c.icon size={16} style={{ color: c.color }} />
              </div>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Spend Trend */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--foreground)' }}>30-Day Spend Trend</h2>
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>Daily LLM expenditure breakdown</p>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'hsl(34, 80%, 65%)' }} /> Total Cost
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-foreground)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'hsl(195, 50%, 50%)' }} /> Thinking Cost
            </span>
          </div>
        </div>
        {/* Chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, paddingBottom: 4 }}>
          {DEMO_COST_TREND.slice(-20).map((day: any, i: number) => {
            const maxVal = Math.max(...DEMO_COST_TREND.map((d: any) => d.cost));
            const h = Math.max(4, (day.cost / maxVal) * 112);
            const ht = Math.max(2, (day.thinkingCost / maxVal) * 112);
            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, position: 'relative' }} title={`${day.date}: $${day.cost}`}>
                <div style={{ height: ht, background: 'hsl(195 50% 45% / 0.6)', borderRadius: '2px 2px 0 0' }} />
                <div style={{ height: h - ht, background: `linear-gradient(180deg, hsl(34 80% 65%), hsl(34 80% 50%))`, borderRadius: '2px 2px 0 0' }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted-foreground)', fontFamily: "'DM Mono', monospace", marginTop: 8 }}>
          <span>{DEMO_COST_TREND.slice(-20)[0]?.date}</span>
          <span>Today</span>
        </div>
      </div>

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* Cost by feature */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginBottom: 20 }}>Cost by Feature</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {features.map((f: any) => {
              const pct = (f.costUsd / maxCost) * 100;
              return (
                <div key={f.featureName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{f.featureName}</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: 'var(--muted-foreground)' }}>{f.calls.toLocaleString()} calls</span>
                      <span style={{ fontWeight: 700, color: 'hsl(34, 80%, 65%)', fontFamily: "'DM Mono', monospace" }}>${f.costUsd.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By provider */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--foreground)', marginBottom: 18 }}>By Provider</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DEMO_COST_BY_PROVIDER.map((p, i) => {
              const c = ['hsl(34, 80%, 65%)', 'hsl(195, 50%, 60%)', 'hsl(160, 45%, 60%)'][i];
              return (
                <div key={p.provider} style={{ padding: '14px 16px', background: 'hsl(225 14% 10%)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: 14 }}>{p.provider}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: c, fontWeight: 600 }}>
                      <ArrowUpRight size={12} /> {p.percentage}%
                    </div>
                  </div>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 800, color: c, marginBottom: 6 }}>${p.costUsd.toFixed(2)}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {p.models.map((m: string) => (
                      <span key={m} style={{ fontSize: 10, padding: '2px 8px', background: `${c}22`, color: c, borderRadius: 999, border: `1px solid ${c}44`, fontFamily: "'DM Mono', monospace" }}>{m}</span>
                    ))}
                  </div>
                  <div className="progress-track" style={{ marginTop: 12 }}>
                    <div className="progress-fill" style={{ width: `${p.percentage}%`, background: `linear-gradient(90deg, ${c}, ${c}bb)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostAnalyticsPage;
