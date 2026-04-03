import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Shield, DollarSign, Bot, Brain, Eye,
  Activity, Settings, CreditCard, Upload, Lock,
  Bell, Search, ChevronRight, Zap, Menu, X
} from 'lucide-react';
import SplashScreen from './components/SplashScreen';

/* ═══ Aurora orbs (exact repo palette: amber + teal + emerald on navy) ════ */
function AuroraBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Ambient orbs */}
      {[
        { c: 'hsl(34,80%,56%)',  x: '5%',   y: '10%', s: 520, a: 'aurora-1 20s ease-in-out infinite' },
        { c: 'hsl(195,50%,45%)', x: '80%',  y: '8%',  s: 440, a: 'aurora-2 24s ease-in-out infinite' },
        { c: 'hsl(34,65%,36%)',  x: '45%',  y: '55%', s: 600, a: 'aurora-3 28s ease-in-out infinite' },
        { c: 'hsl(160,45%,48%)', x: '90%',  y: '75%', s: 360, a: 'aurora-1 22s ease-in-out infinite reverse' },
        { c: 'hsl(195,40%,30%)', x: '15%',  y: '85%', s: 400, a: 'aurora-2 26s ease-in-out infinite reverse' },
      ].map((o, i) => (
        <div key={i} style={{
          position: 'absolute', left: o.x, top: o.y,
          width: o.s, height: o.s, borderRadius: '50%',
          background: o.c, filter: 'blur(130px)',
          opacity: 0.1, transform: 'translate(-50%,-50%)',
          animation: o.a, willChange: 'transform',
        }} />
      ))}
      {/* dot-grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.035) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />
    </div>
  );
}

/* ═══ Sidebar nav structure ═══════════════════════════ */
const NAV_GROUPS = [
  {
    label: 'CORE',
    items: [
      { to: '/',            icon: LayoutDashboard, label: 'Dashboard'   },
      { to: '/security',    icon: Shield,          label: 'Security'    },
      { to: '/costs',       icon: DollarSign,      label: 'LLM Costs'  },
      { to: '/agent-guard', icon: Bot,             label: 'AgentGuard' },
    ],
  },
  {
    label: 'ANALYSIS',
    items: [
      { to: '/thinking-tokens', icon: Brain,    label: 'Thinking Tokens' },
      { to: '/shadow-apis',     icon: Eye,      label: 'Shadow APIs'     },
      { to: '/activity',        icon: Activity, label: 'Activity'        },
    ],
  },
  {
    label: 'WORKSPACE',
    items: [
      { to: '/postman',    icon: Upload,      label: 'Import APIs'  },
      { to: '/compliance', icon: Lock,        label: 'Compliance'   },
      { to: '/billing',    icon: CreditCard,  label: 'Billing'      },
      { to: '/settings',   icon: Settings,    label: 'Settings'     },
    ],
  },
];

/* ═══ Page title lookup ════════════════════════════════ */
const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/':                { title: 'Dashboard',        sub: 'API health overview' },
  '/security':        { title: 'Security',          sub: 'OWASP vulnerability scanning' },
  '/costs':           { title: 'LLM Costs',         sub: 'Model spend analytics' },
  '/agent-guard':     { title: 'AgentGuard',        sub: 'Autonomous kill-switch protection' },
  '/thinking-tokens': { title: 'Thinking Tokens',   sub: 'Chain-of-thought cost breakdown' },
  '/shadow-apis':     { title: 'Shadow APIs',       sub: 'Undocumented endpoint detection' },
  '/activity':        { title: 'Activity Feed',     sub: 'Real-time event stream' },
  '/postman':         { title: 'Import APIs',       sub: 'Postman collection importer' },
  '/compliance':      { title: 'Compliance',        sub: 'GDPR & SOC 2 readiness' },
  '/billing':         { title: 'Billing',           sub: 'Subscription & usage' },
  '/settings':        { title: 'Settings',          sub: 'Workspace configuration' },
};

/* ═══ Sidebar Component ════════════════════════════════ */
function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const W = collapsed ? 64 : 228;

  return (
    <aside style={{
      width: W, minHeight: '100vh',
      background: 'hsl(225 14% 7%)',
      borderRight: '1px solid hsl(225 10% 13%)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
      transition: 'width 200ms cubic-bezier(0.16,1,0.3,1)',
      overflow: 'hidden',
      boxShadow: '4px 0 24px hsl(225 14% 3% / 0.3)',
    }}>

      {/* Logo row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: collapsed ? '18px 18px' : '18px 20px',
        borderBottom: '1px solid hsl(225 10% 13%)',
        height: 60, gap: 10, flexShrink: 0,
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, hsl(34,80%,56%), hsl(34,80%,40%))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 18px hsl(34 80% 56% / 0.35)',
          }}>
            <Zap size={14} color="hsl(225,14%,6%)" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <span style={{
              fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
              fontSize: 16, fontWeight: 800, color: 'hsl(40,20%,95%)',
              whiteSpace: 'nowrap',
            }}>DevPulse</span>
          )}
        </div>
        {!collapsed && (
          <button onClick={onToggle} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'hsl(225,10%,40%)', padding: 4, borderRadius: 6,
            display: 'flex', transition: 'color 80ms',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'hsl(40,20%,80%)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'hsl(225,10%,40%)'}
          >
            <Menu size={15} />
          </button>
        )}
        {collapsed && (
          <button onClick={onToggle} style={{
            position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
            background: 'hsl(225 10% 14%)', border: '1px solid hsl(225 10% 18%)',
            cursor: 'pointer', color: 'hsl(225,10%,50%)',
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 80ms',
          }}>
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            {!collapsed && (
              <p style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: '0.12em',
                color: 'hsl(225,10%,32%)', fontFamily: "'DM Mono', monospace",
                padding: '10px 20px 6px', textTransform: 'uppercase',
              }}>{group.label}</p>
            )}
            {collapsed && <div style={{ height: 10 }} />}

            {group.items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '9px 0' : '8px 14px',
                  margin: collapsed ? '0 8px' : '1px 8px',
                  borderRadius: 10,
                  textDecoration: 'none',
                  color: isActive ? 'hsl(34,80%,62%)' : 'hsl(225,10%,55%)',
                  background: isActive ? 'hsl(34 80% 56% / 0.1)' : 'transparent',
                  borderLeft: isActive && !collapsed ? '2px solid hsl(34,80%,56%)' : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  transition: 'all 80ms ease-out',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                })}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  if (!el.classList.contains('active')) {
                    el.style.background = 'hsl(225 10% 14%)';
                    el.style.color = 'hsl(40,20%,80%)';
                  }
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  if (!el.classList.contains('active')) {
                    el.style.background = 'transparent';
                    el.style.color = 'hsl(225,10%,55%)';
                  }
                }}
              >
                <item.icon size={15} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User card */}
      {!collapsed && (
        <div style={{
          padding: '12px 14px', borderTop: '1px solid hsl(225 10% 13%)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, hsl(34,80%,56%), hsl(195,50%,45%))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800, color: 'hsl(225,14%,6%)',
            boxShadow: '0 0 12px hsl(34 80% 56% / 0.3)',
          }}>A</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(40,20%,88%)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Akshu</p>
            <p style={{ fontSize: 10.5, color: 'hsl(225,10%,42%)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>Pro Plan</p>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'hsl(160,45%,48%)', boxShadow: '0 0 8px hsl(160,45%,48%)' }} />
        </div>
      )}
      {collapsed && (
        <div style={{ padding: '12px 0', borderTop: '1px solid hsl(225 10% 13%)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, hsl(34,80%,56%), hsl(195,50%,45%))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'hsl(225,14%,6%)',
          }}>A</div>
        </div>
      )}
    </aside>
  );
}

/* ═══ Top header ═══════════════════════════════════════ */
function TopHeader({ sidebarW }: { sidebarW: number }) {
  const loc = useLocation();
  const meta = PAGE_META[loc.pathname] || { title: 'DevPulse', sub: '' };
  const [searching, setSearching] = useState(false);

  return (
    <header style={{
      position: 'fixed', top: 0, left: sidebarW, right: 0, height: 58, zIndex: 40,
      background: 'hsl(225 14% 6% / 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid hsl(225 10% 12%)',
      display: 'flex', alignItems: 'center',
      padding: '0 28px', gap: 16,
      transition: 'left 200ms cubic-bezier(0.16,1,0.3,1)',
      boxShadow: '0 1px 0 hsl(225 14% 3% / 0.5)',
    }}>
      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
          fontSize: 17, fontWeight: 800, color: 'hsl(40,20%,95%)',
          lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{meta.title}</p>
        {meta.sub && (
          <p style={{ fontSize: 11, color: 'hsl(225,10%,42%)', fontFamily: "'DM Mono',monospace", marginTop: 1 }}>{meta.sub}</p>
        )}
      </div>

      {/* Live badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
        borderRadius: 999, background: 'hsl(160 45% 48% / 0.08)',
        border: '1px solid hsl(160 45% 48% / 0.2)', flexShrink: 0,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(160,45%,48%)', boxShadow: '0 0 6px hsl(160,45%,48%)', animation: 'dot-blink 2s ease-in-out infinite' }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(160,45%,58%)', fontFamily: "'DM Mono',monospace" }}>LIVE</span>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'hsl(225 10% 12%)', border: '1px solid hsl(225 10% 16%)',
        borderRadius: 10, padding: '6px 12px', transition: 'all 100ms',
        width: searching ? 240 : 160, flexShrink: 0,
      }}>
        <Search size={13} color="hsl(225,10%,40%)" style={{ flexShrink: 0 }} />
        <input
          placeholder="Search..."
          onFocus={() => setSearching(true)}
          onBlur={() => setSearching(false)}
          style={{
            background: 'none', border: 'none', outline: 'none',
            fontFamily: "'DM Sans', sans-serif", fontSize: 12.5,
            color: 'hsl(40,20%,88%)', width: '100%',
          }}
        />
        {searching && <kbd style={{ fontSize: 9, color: 'hsl(225,10%,36%)', border: '1px solid hsl(225,10%,22%)', borderRadius: 4, padding: '1px 5px', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap', flexShrink: 0 }}>ESC</kbd>}
      </div>

      {/* Bell */}
      <button style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: 'hsl(225 10% 12%)', border: '1px solid hsl(225 10% 16%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'hsl(225,10%,50%)',
        transition: 'all 80ms', position: 'relative',
      }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background='hsl(225 10% 16%)'; el.style.color='hsl(40,20%,80%)'; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background='hsl(225 10% 12%)'; el.style.color='hsl(225,10%,50%)'; }}
      >
        <Bell size={14} />
        <span style={{
          position: 'absolute', top: 7, right: 7, width: 7, height: 7,
          borderRadius: '50%', background: 'hsl(4,70%,55%)',
          border: '1.5px solid hsl(225,14%,6%)',
        }} />
      </button>

      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, hsl(34,80%,56%), hsl(195,50%,45%))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: 'hsl(225,14%,6%)',
        cursor: 'pointer', boxShadow: '0 0 12px hsl(34 80% 56% / 0.3)',
        fontFamily: "'DM Sans', sans-serif",
      }}>A</div>
    </header>
  );
}

/* ═══ Lazy pages ═══════════════════════════════════════ */
const HomePage          = lazy(() => import('./pages/HomePage'));
const SecurityPage       = lazy(() => import('./pages/SecurityPage'));
const CostAnalyticsPage  = lazy(() => import('./pages/CostAnalyticsPage'));
const AgentGuardPage     = lazy(() => import('./pages/AgentGuardPage'));
const ThinkingTokensPage = lazy(() => import('./pages/ThinkingTokensPage'));
const ShadowApisPage     = lazy(() => import('./pages/ShadowApisPage'));
const ActivityPage       = lazy(() => import('./pages/ActivityPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const BillingPage        = lazy(() => import('./pages/BillingPage'));
const PostmanImportPage  = lazy(() => import('./pages/PostmanImportPage'));
const CompliancePage     = lazy(() => import('./pages/CompliancePage'));

/* ═══ Spinner ══════════════════════════════════════════ */
function Spinner() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:28 }}>
      {/* Heartbeat Pulse Animation */}
      <svg viewBox="0 0 400 120" style={{ width:'280px', height:'84px', overflow:'visible' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="spinner-pulse-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(34,80%,56%)" stopOpacity="0" />
            <stop offset="25%" stopColor="hsl(34,80%,56%)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="hsl(34,80%,56%)" stopOpacity="1" />
            <stop offset="75%" stopColor="hsl(34,80%,56%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(34,80%,56%)" stopOpacity="0" />
          </linearGradient>
          <filter id="spinner-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line x1="0" y1="60" x2="400" y2="60" stroke="hsl(225,10%,25%)" strokeOpacity="0.15" strokeWidth="0.5" />
        <path d="M0,60 L80,60 L95,60 L105,40 L115,60 L140,60 L155,60 L165,80 L175,20 L185,75 L200,50 L220,60 L260,60 L290,48 L320,60 L400,60" 
              fill="none" 
              stroke="url(#spinner-pulse-grad)" 
              strokeWidth="2" 
              filter="url(#spinner-glow)"
              style={{ animation:'heartbeat-pulse 5.5s ease-in-out infinite' }} />
      </svg>
      <span style={{ fontSize:11.5, color:'hsl(225,10%,40%)', fontFamily:"'DM Mono',monospace", letterSpacing:'0.06em' }}>loading...</span>
    </div>
  );
}

/* ═══ App Shell ════════════════════════════════════════ */
function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const sidebarW = collapsed ? 64 : 228;

  return (
    <>
      <SplashScreen done={splashDone} onDone={() => setSplashDone(true)} />
      <AuroraBackground />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <TopHeader sidebarW={sidebarW} />

      {/* Main content area */}
      <main style={{
        marginLeft: sidebarW,
        marginTop: 58,
        minHeight: 'calc(100vh - 58px)',
        position: 'relative', zIndex: 1,
        transition: 'margin-left 200ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/"                element={<HomePage />} />
            <Route path="/security"        element={<SecurityPage />} />
            <Route path="/costs"           element={<CostAnalyticsPage />} />
            <Route path="/agent-guard"     element={<AgentGuardPage />} />
            <Route path="/thinking-tokens" element={<ThinkingTokensPage />} />
            <Route path="/shadow-apis"     element={<ShadowApisPage />} />
            <Route path="/activity"        element={<ActivityPage />} />
            <Route path="/settings"        element={<SettingsPage />} />
            <Route path="/billing"         element={<BillingPage />} />
            <Route path="/postman"         element={<PostmanImportPage />} />
            <Route path="/compliance"      element={<CompliancePage />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
