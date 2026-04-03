import React, { useState, useRef } from 'react';
import { Bot, Activity, DollarSign, AlertTriangle, Zap, Clock } from 'lucide-react';
import { BorderBeam, Ripple, SpotlightCard, NumberTicker, GlowBadge, ShimmerButton } from '../components/magic';
import { DEMO_AGENT_STATS, DEMO_AGENTS, DEMO_INTERVENTIONS } from '../utils/demoData';
import { trpc } from '../utils/trpc';

function relativeTime(ms: number) {
  const s = (ms - Date.now()) / 1000;
  if (Math.abs(s) < 60) return 'just now';
  if (Math.abs(s) < 3600) return `${Math.abs(Math.round(s / 60))}m ago`;
  return `${Math.abs(Math.round(s / 3600))}h ago`;
}

export const AgentGuardPage: React.FC = () => {
  const [killing, setKilling] = useState(false);
  const [killed, setKilled] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data } = trpc.agentGuard.getSummary.useQuery({ workspaceId: 1 }, { enabled: false });
  const stats = data ?? DEMO_AGENT_STATS;
  const agents = DEMO_AGENTS;
  const interventions = DEMO_INTERVENTIONS;

  const budgetPct = Math.round((stats.totalCost / stats.budgetLimit) * 100);

  const runKillDemo = () => {
    if (killing || killed) return;
    setKilling(true);
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += 4 + Math.random() * 6;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(iv);
        setKilling(false);
        setKilled(true);
        setTimeout(() => { setKilled(false); setProgress(0); }, 4000);
      }
    }, 120);
  };

  const RISK_COLOR = stats.riskScore >= 70 ? 'hsl(4,72%,65%)' : stats.riskScore >= 40 ? 'hsl(38,75%,65%)' : 'hsl(158,50%,60%)';

  return (
    <div style={{ padding: '36px 40px 56px', display: 'flex', flexDirection: 'column', gap: 28, background: 'var(--col-bg)', minHeight: '100vh' }}>

      {/* ── Page header ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'hsl(158,50%,58%)', marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>Autonomous Protection</p>
          <h1 style={{
            fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 900, lineHeight: 1.05, marginBottom: 8,
            background: 'linear-gradient(135deg, hsl(40,90%,82%), hsl(34,84%,62%), hsl(158,50%,60%))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>AgentGuard</h1>
          <p style={{ fontSize: 14, color: 'hsl(225,10%,48%)' }}>Real-time agent monitoring with autonomous kill switch at budget thresholds.</p>
        </div>

        {/* ── KILL SWITCH DEMO BUTTON ────────────────────── */}
        <div style={{ position: 'relative' }}>
          {(killing || killed) && (
            <Ripple
              color={killed ? 'hsl(158,50%,48%)' : 'hsl(4,72%,56%)'}
              count={4} duration={2} maxRadius={56}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
            />
          )}
          <button
            onClick={runKillDemo}
            style={{
              position: 'relative', zIndex: 1,
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '12px 26px', borderRadius: 12, cursor: killing ? 'wait' : 'pointer',
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, border: 'none',
              transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
              background: killed
                ? 'linear-gradient(135deg, hsl(158,50%,38%), hsl(158,50%,30%))'
                : killing
                  ? 'linear-gradient(135deg, hsl(38,75%,40%), hsl(25,80%,35%))'
                  : 'linear-gradient(135deg, hsl(4,72%,46%), hsl(4,72%,38%))',
              color: 'white',
              boxShadow: killed
                ? '0 0 0 1px hsl(158 50% 48% / 0.3), 0 4px 20px hsl(158 50% 48% / 0.3)'
                : killing
                  ? '0 0 0 1px hsl(38 75% 55% / 0.3), 0 4px 20px hsl(38 75% 55% / 0.25)'
                  : '0 0 0 1px hsl(4 72% 56% / 0.3), 0 4px 20px hsl(4 72% 56% / 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {killed ? <><Zap size={16} /> All Agents Killed!</> : killing ? <><Activity size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Terminating...</> : <><Zap size={16} /> Kill Switch Demo</>}
          </button>
        </div>
      </div>

      {/* ── Progress bar (only when kill in progress) ────── */}
      {killing && (
        <div style={{ padding: '18px 24px', borderRadius: 14, background: 'hsl(225,14%,9%)', border: '1px solid hsl(4 72% 56% / 0.2)', boxShadow: '0 0 20px hsl(4 72% 56% / 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: 'hsl(4,72%,65%)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'hsl(4,72%,56%)', boxShadow: '0 0 8px hsl(4,72%,56%)', display: 'inline-block', animation: 'pulse-badge 1s infinite' }} />
              Sending kill signals to all active agents...
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: 'hsl(38,75%,65%)' }}>{Math.floor(progress)}%</span>
          </div>
          <div style={{ height: 7, background: 'hsl(225,13%,14%)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: `linear-gradient(90deg, hsl(4,72%,56%) ${100 - progress}%, hsl(158,50%,48%) 100%)`,
              width: `${progress}%`, transition: 'width 120ms linear',
              boxShadow: `0 0 12px hsl(4 72% 56% / 0.5)`,
            }} />
          </div>
        </div>
      )}

      {/* ── KPI row ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { label: 'Total Agents', val: stats.totalAgents, sub: `${stats.activeAgents} active`, icon: Bot, color: 'hsl(195,54%,52%)', ic: 'icon-teal', glow: 'hsl(195 54% 46% / 0.12)' },
          { label: "Today's Cost", val: null, valStr: `$${stats.totalCost.toFixed(2)}`, sub: `Budget: $${stats.budgetLimit}/day`, icon: DollarSign, color: 'hsl(34,84%,65%)', ic: 'icon-amber', glow: 'hsl(34 84% 58% / 0.14)' },
          { label: 'Risk Score', val: null, valStr: `${stats.riskScore}/100`, sub: `Tier: ${stats.riskTier}`, icon: AlertTriangle, color: RISK_COLOR, ic: stats.riskScore >= 70 ? 'icon-red' : 'icon-orange', glow: `${RISK_COLOR.replace(')','/0.12)')}` },
          { label: 'Auto-Kills', val: stats.interventions, sub: `$${(78.60).toFixed(2)} saved today`, icon: Zap, color: 'hsl(4,72%,65%)', ic: 'icon-red', glow: 'hsl(4 72% 56% / 0.12)' },
        ].map((c, i) => (
          <SpotlightCard key={i} glowColor={c.glow} tiltAmount={6} className="fade-up"
            style={{ borderRadius: 15, animationDelay: `${i*70}ms`, background: 'hsl(225,14%,9%)', border: '1px solid hsl(225,12%,14%)', padding: '20px 22px', boxShadow: '0 2px 4px hsl(225 16% 2% / 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div className={c.ic} style={{ width: 36, height: 36, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><c.icon size={17} /></div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}2e`, fontFamily: "'DM Mono',monospace" }}>{c.sub}</span>
            </div>
            <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'hsl(225,10%,42%)', marginBottom: 6, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{c.label}</p>
            {c.val !== null ? (
              <div className="count-in" style={{ animationDelay: `${i*70+200}ms` }}>
                <NumberTicker value={c.val!} color={c.color} size={28} duration={800} />
              </div>
            ) : (
              <p style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.valStr}</p>
            )}
          </SpotlightCard>
        ))}
      </div>

      {/* ── Budget meter ─────────────────────────────────── */}
      <div style={{ padding: '20px 24px', borderRadius: 14, background: 'hsl(225,14%,9%)', border: '1px solid hsl(225,12%,14%)', position: 'relative', overflow: 'hidden' }}>
        <BorderBeam size={200} duration={12} colorFrom="hsl(34,84%,65%)" colorTo="hsl(4,72%,56%)" borderWidth={1} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(40,18%,86%)', marginBottom: 2 }}>Daily Budget Consumption</p>
            <p style={{ fontSize: 11, color: 'hsl(225,10%,42%)' }}>Across all {stats.totalAgents} monitored agents</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 800, color: budgetPct > 75 ? 'hsl(38,75%,65%)' : 'hsl(158,50%,60%)' }}>{budgetPct}%</p>
            <p style={{ fontSize: 11, color: 'hsl(225,10%,42%)' }}>${stats.totalCost.toFixed(2)} of ${stats.budgetLimit}</p>
          </div>
        </div>
        <div style={{ height: 8, background: 'hsl(225,13%,14%)', borderRadius: 99, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          <div style={{
            height: '100%', borderRadius: 99, width: `${budgetPct}%`,
            background: budgetPct > 75
              ? 'linear-gradient(90deg, hsl(38,75%,55%), hsl(25,80%,58%))'
              : 'linear-gradient(90deg, hsl(34,84%,56%), hsl(158,50%,48%))',
            boxShadow: `0 0 14px ${budgetPct > 75 ? 'hsl(38 75% 55% / 0.45)' : 'hsl(34 84% 56% / 0.4)'}`,
            transition: 'width 800ms cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>
      </div>

      {/* ── Active agents + Incidents ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

        {/* Agents list */}
        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'hsl(225,14%,9%)', border: '1px solid hsl(225,12%,14%)' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid hsl(225,12%,13%)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={15} style={{ color: 'hsl(34,84%,65%)' }} />
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, color: 'hsl(40,18%,90%)' }}>Active Agents</h2>
            <GlowBadge color="hsl(158,50%,65%)" bg="hsl(158 50% 48% / 0.1)" border="hsl(158 50% 48% / 0.28)" style={{ marginLeft: 'auto' }}>
              {agents.filter((a: any) => !a.isKilled).length} live
            </GlowBadge>
          </div>
          <div>
            {agents.map((agent: any, i: number) => (
              <div key={agent.agentId} className="fade-up" style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px',
                borderBottom: i < agents.length - 1 ? '1px solid hsl(225,12%,12%)' : 'none',
                transition: 'background 70ms', animationDelay: `${i*60+300}ms`,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(225,13%,11%)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Status dot with pulse */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: agent.isKilled ? 'hsl(225,10%,38%)' : 'hsl(158,50%,50%)', boxShadow: agent.isKilled ? 'none' : '0 0 10px hsl(158,50%,50%)' }} />
                  {!agent.isKilled && <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '1.5px solid hsl(158 50% 50% / 0.4)', animation: 'pulse-ring 2.4s ease-out infinite' }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 600, color: 'hsl(40,18%,88%)' }}>{agent.agentId}</p>
                  <p style={{ fontSize: 11, color: 'hsl(225,10%,42%)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {agent.totalCalls.toLocaleString()} calls ·
                    <span style={{ color: 'hsl(34,84%,65%)', fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>${agent.totalCost.toFixed(2)}</span>
                  </p>
                </div>

                {/* Time ago */}
                <span style={{ fontSize: 10, color: 'hsl(225,10%,34%)', fontFamily: "'DM Mono',monospace", display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <Clock size={10} /> {relativeTime(agent.lastSeen)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Incidents */}
        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'hsl(225,14%,9%)', border: '1px solid hsl(225,12%,14%)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(225,12%,13%)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} style={{ color: 'hsl(4,72%,65%)' }} />
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: 'hsl(40,18%,90%)' }}>Incidents</h2>
          </div>
          <div style={{ padding: '8px 0' }}>
            {interventions.map((iv: any, i: number) => (
              <div key={i} style={{
                padding: '14px 18px',
                borderBottom: i < interventions.length - 1 ? '1px solid hsl(225,12%,12%)' : 'none',
                background: 'hsl(4 72% 56% / 0.04)', borderLeft: '3px solid hsl(4 72% 56% / 0.45)',
                transition: 'background 80ms',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(4 72% 56% / 0.07)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'hsl(4 72% 56% / 0.04)'}
              >
                <p style={{ fontSize: 11.5, fontWeight: 600, color: 'hsl(4,72%,70%)', marginBottom: 4, lineHeight: 1.4 }}>{iv.reason}</p>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: 'hsl(225,10%,42%)', marginBottom: 5 }}>{iv.agentId}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(34,84%,65%)', fontFamily: "'DM Mono',monospace" }}>${iv.costUsd}</span>
                  <span style={{ fontSize: 10, color: 'hsl(225,10%,38%)', fontFamily: "'DM Mono',monospace" }}>
                    {new Date(iv.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentGuardPage;
