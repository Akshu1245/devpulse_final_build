import React from 'react';
import { Lock, CheckCircle2, AlertCircle, Clock, Shield, Globe, FileText, Cpu } from 'lucide-react';

const FRAMEWORKS = [
  {
    name: 'OWASP API Security Top 10',
    icon: Shield, color: 'hsl(4, 70%, 65%)', glow: 'var(--glow-destructive)',
    items: [
      { id: 'API1', name: 'Broken Object Level Authorization', status: 'fail', details: '3 endpoints vulnerable' },
      { id: 'API2', name: 'Broken User Authentication', status: 'warn', details: 'Rate limiting missing' },
      { id: 'API3', name: 'Excessive Data Exposure', status: 'fail', details: '2 endpoints over-exposing' },
      { id: 'API4', name: 'Lack of Resources & Rate Limiting', status: 'warn', details: '5 endpoints unprotected' },
      { id: 'API5', name: 'Broken Function Level Authorization', status: 'pass', details: 'All admin routes secured' },
      { id: 'API6', name: 'Mass Assignment', status: 'fail', details: '1 endpoint vulnerable' },
      { id: 'API7', name: 'Security Misconfiguration', status: 'pass', details: 'Headers correctly configured' },
      { id: 'API8', name: 'Injection', status: 'fail', details: 'SQL injection on /search' },
      { id: 'API9', name: 'Improper Assets Management', status: 'warn', details: '5 shadow APIs detected' },
      { id: 'API10', name: 'Insufficient Logging & Monitoring', status: 'pass', details: 'Full audit trail active' },
    ],
  },
];

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
  pass: { color: 'hsl(160, 45%, 65%)', bg: 'hsl(160 45% 48% / 0.12)', border: 'hsl(160 45% 48% / 0.3)', icon: CheckCircle2, label: 'Pass' },
  warn: { color: 'hsl(38, 75%, 65%)', bg: 'hsl(38 75% 55% / 0.12)', border: 'hsl(38 75% 55% / 0.3)', icon: AlertCircle, label: 'Warn' },
  fail: { color: 'hsl(4, 70%, 65%)', bg: 'hsl(4 70% 55% / 0.12)', border: 'hsl(4 70% 55% / 0.3)', icon: AlertCircle, label: 'Fail' },
};

export const CompliancePage: React.FC = () => {
  const items = FRAMEWORKS[0].items;
  const pass = items.filter(i => i.status === 'pass').length;
  const warn = items.filter(i => i.status === 'warn').length;
  const fail = items.filter(i => i.status === 'fail').length;
  const score = Math.round((pass / items.length) * 100);

  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(4, 70%, 65%)', marginBottom: 6 }}>Security Audit</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Compliance Report</h1>
          <p style={{ color: 'var(--muted-foreground)', marginTop: 4 }}>OWASP API Security Top 10 compliance status for your workspace.</p>
        </div>
        <div className="glass-card" style={{ borderRadius: 14, padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 40, fontWeight: 900, fontFamily: "'DM Mono', monospace", color: score >= 70 ? 'hsl(160, 45%, 60%)' : score >= 40 ? 'hsl(38, 75%, 65%)' : 'hsl(4, 70%, 65%)', lineHeight: 1 }}>{score}%</p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>Compliance Score</p>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[
          { label: 'Passing', value: pass, icon: CheckCircle2, color: 'hsl(160, 45%, 60%)', glow: 'var(--glow-accent)' },
          { label: 'Warnings', value: warn, icon: AlertCircle, color: 'hsl(38, 75%, 65%)', glow: '0 0 20px hsl(38 75% 55% / 0.2)' },
          { label: 'Failing', value: fail, icon: AlertCircle, color: 'hsl(4, 70%, 65%)', glow: 'var(--glow-destructive)' },
        ].map(c => (
          <div key={c.label} className="kpi-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 12, background: `${c.color}22`, borderRadius: 12, boxShadow: c.glow }}>
              <c.icon size={20} style={{ color: c.color }} />
            </div>
            <div>
              <p style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Items list */}
      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} style={{ color: 'hsl(4, 70%, 65%)' }} />
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>OWASP API Security Top 10</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => {
            const cfg = STATUS_CFG[item.status];
            const Icon = cfg.icon;
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 80ms ease-out',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(225 14% 10%)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', minWidth: 40 }}>{item.id}</span>
                <p style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.name}</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', minWidth: 160, textAlign: 'right', paddingRight: 12 }}>{item.details}</p>
                <span style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                }}>
                  <Icon size={12} /> {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default CompliancePage;
