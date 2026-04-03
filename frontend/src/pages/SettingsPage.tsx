import React, { useState } from 'react';
import { Settings, Key, Bell, Globe, Shield, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { DEMO_API_KEYS } from '../utils/demoData';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [showKey, setShowKey] = useState<Record<number, boolean>>({});
  const [budgetLimit, setBudgetLimit] = useState(200);
  const [notifications, setNotifications] = useState({ criticalVulns: true, costSpike: true, agentKills: true, weeklyReport: false });

  const tabs = [
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'workspace', label: 'Workspace', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="ambient-bg dot-grid" style={{ padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: 6 }}>Configuration</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: 'var(--foreground)' }}>Settings</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Tab list */}
        <div className="glass-card" style={{ borderRadius: 14, padding: 10 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
              background: activeTab === t.id ? 'hsl(34 80% 56% / 0.12)' : 'transparent',
              border: activeTab === t.id ? '1px solid hsl(34 80% 56% / 0.25)' : '1px solid transparent',
              color: activeTab === t.id ? 'hsl(34, 80%, 70%)' : 'var(--muted-foreground)',
              fontWeight: activeTab === t.id ? 600 : 400, fontSize: 13,
              fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', transition: 'all 80ms ease-out',
              textAlign: 'left',
            }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="glass-card" style={{ borderRadius: 16, padding: 28 }}>
          {activeTab === 'api-keys' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--foreground)' }}>API Keys</h2>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>Manage provider API credentials</p>
                </div>
                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}><Plus size={14} /> Add Key</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {DEMO_API_KEYS.map(k => (
                  <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'hsl(225 14% 10%)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: 'hsl(34 80% 56% / 0.12)', border: '1px solid hsl(34 80% 56% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Key size={16} style={{ color: 'hsl(34, 80%, 65%)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{k.service}</p>
                      <p style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: 'var(--muted-foreground)', marginTop: 2 }}>
                        {showKey[k.id] ? 'sk-••••••••••••••••••••' + k.maskedKey : k.maskedKey}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowKey(prev => ({ ...prev, [k.id]: !prev[k.id] }))} className="btn-glass" style={{ padding: '7px 10px', fontSize: 12 }}>
                        {showKey[k.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button className="btn-glass" style={{ padding: '7px 10px', color: 'hsl(4, 70%, 65%)', borderColor: 'hsl(4 70% 55% / 0.25)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Alert Configuration</h2>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 24 }}>Choose which events trigger notifications</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {(Object.keys(notifications) as (keyof typeof notifications)[]).map(k => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'hsl(225 14% 10%)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>Instant notification when triggered</p>
                    </div>
                    <button onClick={() => setNotifications(prev => ({ ...prev, [k]: !prev[k] }))} style={{
                      width: 44, height: 24, borderRadius: 999, cursor: 'pointer', border: 'none', transition: 'all 150ms ease-out',
                      background: notifications[k] ? 'hsl(34, 80%, 56%)' : 'hsl(225 14% 18%)',
                      position: 'relative',
                    }}>
                      <span style={{
                        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                        background: 'white', transition: 'left 150ms ease-out',
                        left: notifications[k] ? 23 : 3,
                      }} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, padding: '20px', background: 'hsl(225 14% 10%)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12 }}>Agent Budget Limit</p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="range" min={50} max={500} value={budgetLimit} onChange={e => setBudgetLimit(+e.target.value)} style={{ flex: 1, accentColor: 'hsl(34, 80%, 56%)' }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, color: 'hsl(34, 80%, 65%)', minWidth: 60, textAlign: 'right' }}>${budgetLimit}</span>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'workspace' || activeTab === 'security') && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'hsl(225 14% 12%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Settings size={28} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', marginBottom: 8 }}>Coming Soon</p>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{activeTab === 'workspace' ? 'Workspace management tools' : 'Advanced security policies'} will be available in the next release.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
