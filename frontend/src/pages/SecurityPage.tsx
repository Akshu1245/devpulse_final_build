import React, { useState } from 'react';
import { Shield, Search, X } from 'lucide-react';
import { BorderBeam, SpotlightCard, GlowBadge } from '../components/magic';
import { DEMO_VULNERABILITIES, DEMO_SCANS } from '../utils/demoData';
import { trpc } from '../utils/trpc';

const SEV = {
  critical: { cls: 'badge-critical', color: 'hsl(4,72%,65%)',    bg: 'hsl(4 72% 56% / 0.08)',  border: 'hsl(4 72% 56% / 0.2)' },
  high:     { cls: 'badge-high',     color: 'hsl(28,80%,66%)',   bg: 'hsl(28 85% 55% / 0.08)', border: 'hsl(28 85% 55% / 0.2)' },
  medium:   { cls: 'badge-medium',   color: 'hsl(38,80%,65%)',   bg: 'hsl(38 75% 55% / 0.08)', border: 'hsl(38 75% 55% / 0.2)' },
  low:      { cls: 'badge-low',      color: 'hsl(195,54%,62%)',  bg: 'hsl(195 54% 46% / 0.08)',border: 'hsl(195 54% 46% / 0.2)' },
} as const;

const STATUS = {
  open:         { label: 'Open',        color: 'hsl(4,72%,65%)',   bg: 'hsl(4 72% 56% / 0.1)'  },
  acknowledged: { label: 'Acknowledged',color: 'hsl(38,80%,65%)',  bg: 'hsl(38 75% 55% / 0.1)' },
  resolved:     { label: 'Resolved',    color: 'hsl(158,50%,60%)', bg: 'hsl(158 50% 48% / 0.1)'},
} as const;

const METHOD_COLOR: Record<string, string> = {
  GET: 'hsl(158,50%,58%)', POST: 'hsl(195,54%,58%)', PUT: 'hsl(38,80%,62%)', DELETE: 'hsl(4,72%,62%)', PATCH: 'hsl(28,80%,62%)',
};

export const SecurityPage: React.FC = () => {
  const [search, setSearch]     = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [fixOpen, setFixOpen]   = useState<number | null>(null);

  const { data: vuln } = trpc.security.getVulnerabilities.useQuery({ workspaceId: 1 }, { enabled: false });
  const vulns = vuln ?? DEMO_VULNERABILITIES;
  const scans = DEMO_SCANS;

  const filtered = vulns.filter((v: any) => {
    const matchSev = sevFilter === 'all' || v.severity === sevFilter;
    const matchS   = search === '' || v.endpoint.includes(search) || v.type.toLowerCase().includes(search.toLowerCase());
    return matchSev && matchS;
  });

  const counts = { critical: vulns.filter((v: any) => v.severity === 'critical').length, high: vulns.filter((v: any) => v.severity === 'high').length, medium: vulns.filter((v: any) => v.severity === 'medium').length, low: vulns.filter((v: any) => v.severity === 'low').length };
  const fixVuln = fixOpen !== null ? vulns.find((v: any) => v.id === fixOpen) : null;

  return (
    <div style={{ padding: '36px 40px 56px', display: 'flex', flexDirection: 'column', gap: 28, background: 'var(--col-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'hsl(4,72%,65%)', marginBottom: 6, fontFamily: "'DM Mono',monospace" }}>API Security</p>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, fontWeight: 900,
            background: 'linear-gradient(135deg, hsl(40,90%,82%), hsl(4,72%,65%))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Security Scanning</h1>
          <p style={{ fontSize: 14, color: 'hsl(225,10%,48%)', marginTop: 4 }}>OWASP Top 10 vulnerability analysis across all your endpoints.</p>
        </div>
        <button className="btn btn-primary" style={{ borderRadius: 11, padding: '10px 22px', fontSize: 13 }}>
          <Shield size={14} /> + New Scan
        </button>
      </div>

      {/* ── Severity summary (SpotlightCard) ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {(['critical','high','medium','low'] as const).map((sev, i) => {
          const cfg = SEV[sev];
          const cnt = counts[sev];
          const isActive = sevFilter === sev;
          return (
            <SpotlightCard key={sev} glowColor={cfg.bg} tiltAmount={5}
              className="fade-up"
              style={{
                borderRadius: 15, animationDelay: `${i*70}ms`,
                background: isActive ? cfg.bg : 'hsl(225,14%,9%)',
                border: `1px solid ${isActive ? cfg.border : 'hsl(225,12%,14%)'}`,
                padding: '20px 22px', cursor: 'pointer',
                boxShadow: isActive ? `0 0 0 1px ${cfg.border}, 0 4px 20px ${cfg.bg}` : '0 2px 4px hsl(225 16% 2% / 0.5)',
                transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
              }}
              onClick={() => setSevFilter(isActive ? 'all' : sev)}
            >
              <span className={`badge ${cfg.cls}`} style={{ marginBottom: 12, display: 'inline-flex' }}>{sev}</span>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 32, fontWeight: 900, color: cfg.color, lineHeight: 1, marginBottom: 4 }}>{cnt}</p>
              <p style={{ fontSize: 11, color: 'hsl(225,10%,42%)' }}>vulnerabilities</p>
            </SpotlightCard>
          );
        })}
      </div>

      {/* ── Main table + scan history ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

        {/* Table */}
        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'hsl(225,14%,9%)', border: '1px solid hsl(225,12%,14%)' }}>
          {/* Filters */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(225,12%,13%)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'hsl(225,10%,36%)', pointerEvents: 'none' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search endpoints, vulnerabilities..."
                style={{
                  width: '100%', padding: '9px 12px 9px 32px',
                  background: 'hsl(225,14%,7%)', border: '1px solid hsl(225,12%,16%)',
                  borderRadius: 9, color: 'hsl(40,18%,88%)',
                  fontFamily: "'DM Sans',sans-serif", fontSize: 12.5, outline: 'none',
                  transition: 'border-color 100ms',
                }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'hsl(34 84% 58% / 0.4)'}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'hsl(225,12%,16%)'}
              />
            </div>
            <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="dp-select" style={{ fontSize: 12.5 }}>
              <option value="all">All</option>
              {['critical','high','medium','low'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Thead */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 90px 70px 80px', gap: 8, padding: '10px 20px', borderBottom: '1px solid hsl(225,12%,12%)' }}>
            {['ENDPOINT','VULNERABILITY','SEVERITY','CWE','STATUS','FIX'].map(col => (
              <p key={col} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', color: 'hsl(225,10%,36%)', fontFamily: "'DM Mono',monospace" }}>{col}</p>
            ))}
          </div>

          {/* Rows */}
          {filtered.map((v: any, i: number) => {
            const sc = SEV[v.severity as keyof typeof SEV] ?? SEV.low;
            const st = STATUS[v.status as keyof typeof STATUS] ?? STATUS.open;
            const mc = METHOD_COLOR[v.method] ?? 'hsl(225,10%,55%)';
            return (
              <div key={v.id} className="fade-up" style={{
                display: 'grid', gridTemplateColumns: '200px 1fr 80px 90px 70px 80px',
                gap: 8, padding: '12px 20px', alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? '1px solid hsl(225,12%,11%)' : 'none',
                transition: 'background 70ms', animationDelay: `${i*30+200}ms`,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(225,13%,11%)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Endpoint */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: `${mc}18`, color: mc, border: `1px solid ${mc}2e`, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{v.method}</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: 'hsl(195,54%,65%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.endpoint}</span>
                </div>
                {/* Vuln name */}
                <p style={{ fontSize: 12.5, color: 'hsl(40,18%,82%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{v.type}</p>
                {/* Severity */}
                <span className={`badge ${sc.cls}`}>{v.severity}</span>
                {/* CWE */}
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'hsl(225,10%,45%)' }}>{v.cwe}</span>
                {/* Status */}
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.color, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>{st.label}</span>
                {/* Fix */}
                {v.status !== 'resolved' ? (
                  <button onClick={() => setFixOpen(v.id)} style={{ fontSize: 11.5, fontWeight: 600, color: 'hsl(34,84%,65%)', background: 'hsl(34 84% 56% / 0.08)', border: '1px solid hsl(34 84% 56% / 0.2)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, transition: 'all 80ms' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'hsl(34 84% 56% / 0.16)'; el.style.boxShadow = '0 0 8px hsl(34 84% 56% / 0.2)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'hsl(34 84% 56% / 0.08)'; el.style.boxShadow = 'none'; }}
                  >View Fix</button>
                ) : (
                  <span style={{ fontSize: 11, color: 'hsl(158,50%,55%)' }}>✓ Fixed</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Scan history */}
        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'hsl(225,14%,9%)', border: '1px solid hsl(225,12%,14%)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid hsl(225,12%,13%)' }}>
            <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: 'hsl(40,18%,90%)' }}>Scan History</h2>
          </div>
          {scans.map((scan: any, i: number) => (
            <div key={scan.id} style={{
              padding: '14px 18px',
              borderBottom: i < scans.length - 1 ? '1px solid hsl(225,12%,12%)' : 'none',
              background: i === 0 ? 'hsl(34 84% 56% / 0.05)' : undefined,
              borderLeft: i === 0 ? '3px solid hsl(34 84% 56% / 0.5)' : '3px solid transparent',
              transition: 'background 80ms',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'hsl(225,13%,11%)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i === 0 ? 'hsl(34 84% 56% / 0.05)' : 'transparent'}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(40,18%,86%)', marginBottom: 6 }}>{new Date(scan.createdAt).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}</p>
              <p style={{ fontSize: 11, color: 'hsl(225,10%,42%)', marginBottom: 8 }}>{scan.scannedEndpoints} endpoints scanned</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-critical" style={{ fontSize: 10 }}>{scan.vulnerabilitiesFound} vulns</span>
                <span className="badge badge-resolved" style={{ fontSize: 10 }}>{scan.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fix Panel (slide-over) ────────────────────────── */}
      {fixVuln && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'hsl(225 16% 3% / 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'flex-end',
        }} onClick={() => setFixOpen(null)}>
          <div className="slide-in-right" style={{
            width: 440, height: '100vh', overflowY: 'auto',
            background: 'hsl(225,14%,9%)',
            borderLeft: '1px solid hsl(225,12%,16%)',
            padding: '32px 28px',
            position: 'relative', boxShadow: '-16px 0 48px hsl(225 16% 2% / 0.5)',
          }} onClick={e => e.stopPropagation()}>
            <BorderBeam size={200} duration={14} colorFrom="hsl(34,84%,65%)" colorTo="hsl(4,72%,56%)" borderWidth={1} />
            <button onClick={() => setFixOpen(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'hsl(225,13%,13%)', border: '1px solid hsl(225,12%,18%)', borderRadius: 8, padding: 8, cursor: 'pointer', color: 'hsl(225,10%,55%)', transition: 'color 80ms' }}>
              <X size={16} />
            </button>

            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Severity badge */}
              <span className={`badge badge-${fixVuln.severity}`} style={{ marginBottom: 16, display: 'inline-flex' }}>{fixVuln.severity}</span>
              <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 800, color: 'hsl(40,18%,92%)', marginBottom: 8, lineHeight: 1.2 }}>{fixVuln.type}</h2>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'hsl(195,54%,62%)' }}>{fixVuln.endpoint}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: `${METHOD_COLOR[fixVuln.method] || '#888'}18`, color: METHOD_COLOR[fixVuln.method] || '#888', border: `1px solid ${METHOD_COLOR[fixVuln.method] || '#888'}28` }}>{fixVuln.method}</span>
              </div>

              <div style={{ height: 1, background: 'hsl(225,12%,15%)', marginBottom: 20 }} />

              <p style={{ fontSize: 12, fontWeight: 700, color: 'hsl(225,10%,42%)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>Description</p>
              <p style={{ fontSize: 13.5, color: 'hsl(225,10%,58%)', lineHeight: 1.75, marginBottom: 24 }}>{fixVuln.description}</p>

              <p style={{ fontSize: 12, fontWeight: 700, color: 'hsl(225,10%,42%)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>Recommended Fixes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {fixVuln.recommendations.map((r: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'hsl(34 84% 56% / 0.06)', borderRadius: 10, border: '1px solid hsl(34 84% 56% / 0.16)' }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: 'hsl(34 84% 56% / 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'hsl(34,84%,65%)', flexShrink: 0, fontFamily: "'DM Mono',monospace" }}>{i+1}</span>
                    <p style={{ fontSize: 13, color: 'hsl(40,18%,82%)', lineHeight: 1.6 }}>{r}</p>
                  </div>
                ))}
              </div>

              <GlowBadge style={{ marginBottom: 20 }}>{fixVuln.cwe}</GlowBadge>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ borderRadius: 10, flex: 1 }}>Mark Resolved</button>
                <button className="btn btn-glass" style={{ borderRadius: 10, border: '1px solid hsl(225,12%,20%)' }} onClick={() => setFixOpen(null)}>Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityPage;
