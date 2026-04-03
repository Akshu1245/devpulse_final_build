import React, { useState } from 'react';
import { Eye, AlertTriangle, Filter, List } from 'lucide-react';
import { DEMO_SHADOW_APIS } from '../utils/demoData';

export const ShadowApisPage: React.FC = () => {
  const [riskFilter, setRiskFilter] = useState('All');

  const apis = DEMO_SHADOW_APIS.filter(a => riskFilter === 'All' || a.riskTier === riskFilter);

  const RISK_COLORS: Record<string, string> = {
    CRITICAL: 'hsl(4, 70%, 65%)', HIGH: 'hsl(25, 80%, 65%)', MEDIUM: 'hsl(38, 75%, 65%)', LOW: 'hsl(195, 50%, 60%)',
  };
  const RISK_BG: Record<string, string> = {
    CRITICAL: 'hsl(4 70% 55% / 0.15)', HIGH: 'hsl(25 80% 55% / 0.15)', MEDIUM: 'hsl(38 75% 55% / 0.15)', LOW: 'hsl(195 50% 45% / 0.15)',
  };
  const RISK_BORDER: Record<string, string> = {
    CRITICAL: 'hsl(4 70% 55% / 0.3)', HIGH: 'hsl(25 80% 55% / 0.3)', MEDIUM: 'hsl(38 75% 55% / 0.3)', LOW: 'hsl(195 50% 45% / 0.3)',
  };

  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(38, 75%, 65%)', marginBottom: 6 }}>Threat Detection</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Shadow API Detector</h1>
          <p style={{ color: 'var(--muted-foreground)', marginTop: 4 }}>Discover undocumented, anomalous, and high-risk endpoints in real traffic.</p>
        </div>
        <select className="dp-select" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="All">All Risk Levels</option>
          {['CRITICAL','HIGH','MEDIUM','LOW'].map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(tier => {
          const count = DEMO_SHADOW_APIS.filter(a => a.riskTier === tier).length;
          return (
            <button key={tier} onClick={() => setRiskFilter(riskFilter === tier ? 'All' : tier)}
              className="kpi-card" style={{ textAlign: 'left', cursor: 'pointer', border: riskFilter === tier ? `1px solid ${RISK_BORDER[tier]}` : undefined }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: RISK_BG[tier], color: RISK_COLORS[tier], border: `1px solid ${RISK_BORDER[tier]}`, display: 'inline-block', marginBottom: 8 }}>{tier}</span>
              <p style={{ fontSize: 28, fontWeight: 800, color: RISK_COLORS[tier] }}>{count}</p>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>endpoints</p>
            </button>
          );
        })}
      </div>

      {/* API list */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={16} style={{ color: 'hsl(38, 75%, 65%)' }} />
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>Detected Endpoints</h2>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>{apis.length} found</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {apis.map((api, i) => (
            <div key={api.endpoint} style={{
              padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16,
              borderBottom: i < apis.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 80ms ease-out',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(225 14% 10%)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {/* Risk score circle */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: RISK_BG[api.riskTier],
                border: `1px solid ${RISK_BORDER[api.riskTier]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
              }}>
                <p style={{ fontSize: 14, fontWeight: 900, color: RISK_COLORS[api.riskTier], lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{api.riskScore}</p>
                <p style={{ fontSize: 8, color: RISK_COLORS[api.riskTier], letterSpacing: '0.05em', fontWeight: 600 }}>RISK</p>
              </div>

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600,
                    color: 'hsl(195, 50%, 65%)',
                  }}>{api.endpoint}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                    background: 'hsl(195 50% 45% / 0.15)', color: 'hsl(195, 50%, 65%)', border: '1px solid hsl(195 50% 45% / 0.3)' }}>{api.method}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: RISK_BG[api.riskTier], color: RISK_COLORS[api.riskTier], border: `1px solid ${RISK_BORDER[api.riskTier]}` }}>{api.riskTier}</span>
                  {api.isWhitelisted && <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: 'hsl(160 45% 48% / 0.15)', color: 'hsl(160, 45%, 65%)', border: '1px solid hsl(160 45% 48% / 0.3)' }}>Whitelisted</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {api.riskFactors.map(f => (
                    <span key={f} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, background: 'hsl(225 14% 12%)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>{f.replace(/_/g, ' ')}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 11, color: 'var(--muted-foreground)', fontFamily: "'DM Mono', monospace" }}>
                  <span>{api.callCount.toLocaleString()} calls</span>
                  <span style={{ color: 'hsl(34, 80%, 65%)' }}>${api.totalCost.toFixed(2)}</span>
                  <span>{api.avgLatencyMs}ms avg</span>
                  {api.thinkingTokensUsed > 0 && <span style={{ color: 'hsl(195, 50%, 60%)' }}>{(api.thinkingTokensUsed / 1000).toFixed(0)}K thinking tokens</span>}
                </div>
              </div>

              {!api.isWhitelisted && (
                <button className="btn-glass" style={{ fontSize: 12, padding: '7px 14px', color: 'hsl(160, 45%, 60%)', borderColor: 'hsl(160 45% 48% / 0.3)', flexShrink: 0 }}>Whitelist</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShadowApisPage;
