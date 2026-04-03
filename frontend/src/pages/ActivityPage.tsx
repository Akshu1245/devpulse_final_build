import React from 'react';
import { Activity, Shield, DollarSign, Bot, Upload, Clock } from 'lucide-react';
import { DEMO_ACTIVITY } from '../utils/demoData';

const ICONS: Record<string, any> = {
  vulnerability_found: Shield, scan_completed: Shield, agent_killed: Bot,
  cost_spike: DollarSign, postman_import: Upload,
};
const SEV_COLORS: Record<string, string> = {
  critical: 'hsl(4, 70%, 65%)', high: 'hsl(25, 80%, 65%)', medium: 'hsl(38, 75%, 65%)',
  low: 'hsl(195, 50%, 60%)', info: 'hsl(160, 45%, 60%)',
};
const SEV_BG: Record<string, string> = {
  critical: 'hsl(4 70% 55% / 0.12)', high: 'hsl(25 80% 55% / 0.12)', medium: 'hsl(38 75% 55% / 0.12)',
  low: 'hsl(195 50% 45% / 0.12)', info: 'hsl(160 45% 48% / 0.12)',
};

function formatTs(date: string) {
  const d = new Date(date);
  return d.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const ActivityPage: React.FC = () => {
  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(160, 45%, 60%)', marginBottom: 6 }}>Audit Log</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Activity Feed</h1>
        <p style={{ color: 'var(--muted-foreground)', marginTop: 4 }}>All security events, agent interventions, and system actions in real time.</p>
      </div>

      <div className="glass-card" style={{ borderRadius: 16, overflow: 'hidden' }}>
        {DEMO_ACTIVITY.map((event, i) => {
          const Icon = ICONS[event.type] ?? Activity;
          const color = SEV_COLORS[event.severity] ?? SEV_COLORS.info;
          const bg = SEV_BG[event.severity] ?? SEV_BG.info;
          return (
            <div key={event.id} style={{
              display: 'flex', gap: 20, padding: '20px 24px',
              borderBottom: i < DEMO_ACTIVITY.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 80ms ease-out',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(225 14% 10%)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: bg, border: `1px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 }}>{event.title}</p>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{event.description}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>{event.severity}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Mono', monospace" }}>
                  <Clock size={10} /> {formatTs(event.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ActivityPage;
