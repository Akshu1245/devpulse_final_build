import React from 'react';
import { CreditCard, Check, Zap, Shield, Bot } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter', price: 29, currency: '$', period: 'month', color: 'hsl(195, 50%, 60%)',
    features: ['Up to 100 APIs', '10 security scans/month', 'Basic AgentGuard', 'Email alerts', '7-day retention'],
    cta: 'Get Started',
  },
  {
    name: 'Pro', price: 99, currency: '$', period: 'month', color: 'hsl(34, 80%, 65%)',
    highlighted: true,
    features: ['Unlimited APIs', 'Unlimited scans', 'Full AgentGuard + Kill Switch', 'Thinking token analysis', 'Shadow API detection', '90-day retention', 'Priority support'],
    cta: 'Start Pro Trial',
  },
  {
    name: 'Enterprise', price: null, currency: '$', period: 'month', color: 'hsl(160, 45%, 60%)',
    features: ['Everything in Pro', 'Custom integrations', 'SSO / SAML', 'SLA guarantee', 'Dedicated CSM', 'On-prem option'],
    cta: 'Contact Sales',
  },
];

export const BillingPage: React.FC = () => {
  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 40 }}>
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'hsl(34, 80%, 65%)', marginBottom: 10 }}>Simple Pricing</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: 'var(--foreground)', marginBottom: 12 }}>Choose your plan</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 16, maxWidth: 480, margin: '0 auto' }}>Start free. Scale as you grow. Cancel anytime.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {PLANS.map(plan => (
          <div key={plan.name} className={plan.highlighted ? 'gradient-border' : ''}
            style={{
              borderRadius: 20, padding: 32,
              background: plan.highlighted ? 'linear-gradient(160deg, hsl(225 14% 10%), hsl(225 14% 8%))' : 'var(--glass-bg)',
              border: plan.highlighted ? 'none' : '1px solid var(--glass-border)',
              backdropFilter: 'blur(24px)',
              boxShadow: plan.highlighted ? 'var(--glow-primary), var(--shadow-card)' : 'var(--shadow-card)',
              position: 'relative', overflow: 'hidden',
            }}>

            {plan.highlighted && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, hsl(34 80% 56% / 0.8), transparent)',
              }} />
            )}
            {plan.highlighted && (
              <div style={{
                position: 'absolute', top: -1, right: 20,
                padding: '4px 12px', borderRadius: '0 0 8px 8px',
                background: 'hsl(34, 80%, 56%)', color: 'hsl(225, 14%, 6%)',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
              }}>POPULAR</div>
            )}

            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: plan.color, letterSpacing: '0.05em', marginBottom: 8 }}>{plan.name.toUpperCase()}</p>
              {plan.price !== null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 44, fontWeight: 900, color: 'var(--foreground)' }}>${plan.price}</span>
                  <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>/ {plan.period}</span>
                </div>
              ) : (
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: 'var(--foreground)' }}>Custom</p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {plan.features.map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Check size={14} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>

            <button className={plan.highlighted ? 'btn-primary' : 'btn-glass'} style={{ width: '100%', justifyContent: 'center', borderRadius: 12, padding: '12px 24px', fontSize: 14 }}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Current plan */}
      <div className="glass-card" style={{ borderRadius: 16, padding: 24, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'hsl(34 80% 56% / 0.12)', border: '1px solid hsl(34 80% 56% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={20} style={{ color: 'hsl(34, 80%, 65%)' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Current Plan: <span style={{ color: 'hsl(34, 80%, 65%)' }}>Developer (Demo)</span></p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>Demo mode — connect a backend to activate billing</p>
            </div>
          </div>
          <button className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}><Zap size={14} /> Upgrade Now</button>
        </div>
      </div>
    </div>
  );
};
export default BillingPage;
