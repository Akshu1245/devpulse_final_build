import React, { useState } from 'react';
import { Brain, Zap, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { DEMO_THINKING_SUMMARY, DEMO_THINKING_BY_MODEL } from '../utils/demoData';

export const ThinkingTokensPage: React.FC = () => {
  const s = DEMO_THINKING_SUMMARY;
  const models = DEMO_THINKING_BY_MODEL;
  const maxTokens = Math.max(...models.map(m => m.totalThinkingTokens));

  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(195, 50%, 60%)', marginBottom: 6 }}>Deep AI Analysis</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Thinking Tokens</h1>
        <p style={{ color: 'var(--muted-foreground)', marginTop: 4 }}>Monitor extended reasoning token usage across o1-preview, claude-3.5 and other thinking models.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Thinking Tokens', value: `${(s.totalThinkingTokens / 1000).toFixed(0)}K`, sub: `${s.percentOfTotalTokens}% of all tokens`, icon: Brain, color: 'hsl(195, 50%, 60%)', glow: 'var(--glow-secondary)' },
          { label: 'Estimated Cost', value: `$${s.estimatedCostUsd.toFixed(2)}`, sub: 'Thinking-only cost', icon: Zap, color: 'hsl(34, 80%, 65%)', glow: 'var(--glow-primary)' },
          { label: 'Thinking Events', value: s.eventCount.toLocaleString(), sub: 'Total calls w/ thinking', icon: Activity, color: 'hsl(160, 45%, 60%)', glow: 'var(--glow-accent)' },
          { label: 'Avg per Call', value: String(s.averagePerCall), sub: 'tokens/inference', icon: TrendingUp, color: 'hsl(38, 75%, 65%)', glow: '0 0 20px hsl(38 75% 55% / 0.2)' },
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

      {/* Top feature */}
      <div className="glass-card gradient-border" style={{ borderRadius: 16, padding: 28, background: 'linear-gradient(135deg, hsl(225 14% 9%), hsl(225 14% 7%))' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(34, 80%, 65%)', marginBottom: 10 }}>Top Thinking Consumer</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>{s.topFeature.feature}</p>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {(s.topFeature.tokens / 1000).toFixed(0)}K tokens · <span style={{ color: 'hsl(34, 80%, 65%)' }}>${s.topFeature.cost.toFixed(2)}</span> · {s.topFeature.percent}% of thinking spend
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {s.modelsUsing.map(m => (
              <span key={m} style={{ padding: '4px 12px', background: 'hsl(195 50% 45% / 0.15)', border: '1px solid hsl(195 50% 45% / 0.3)', borderRadius: 999, fontSize: 11, fontWeight: 600, color: 'hsl(195, 50%, 65%)', fontFamily: "'DM Mono', monospace" }}>{m}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Per model breakdown */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 28 }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginBottom: 24 }}>Breakdown by Model</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {models.map((m, i) => {
            const pct = (m.totalThinkingTokens / maxTokens) * 100;
            const c = ['hsl(195, 50%, 60%)', 'hsl(34, 80%, 65%)', 'hsl(160, 45%, 60%)'][i];
            return (
              <div key={m.model}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{m.model}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                      Avg {m.averageThinkingTokensPerCall} tokens/call · {m.eventCount.toLocaleString()} events
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 800, color: c }}>${m.estimatedCostUsd.toFixed(2)}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.percentOfTotalCost}% of thinking spend</p>
                  </div>
                </div>
                <div className="progress-track" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}, ${c}cc)` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThinkingTokensPage;
