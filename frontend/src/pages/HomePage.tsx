// DevPulse Home Page - Modern Dashboard with Interactive Charts
import React, { useEffect, useRef, useState, useMemo, Suspense, lazy } from 'react';
import {
  Shield, AlertTriangle, DollarSign, Bot, TrendingUp,
  Activity, ArrowUpRight, Zap, Upload, Eye, Lock, ChevronRight, Cpu,
  Sun, Moon, Bell, Search, RefreshCw, MoreHorizontal,
  ArrowUp, ArrowDown, TrendingDown
} from 'lucide-react';
import { DEMO_STATS, DEMO_ACTIVITY, DEMO_VULNERABILITIES, DEMO_AGENTS, DEMO_COST_TREND } from '../utils/demoData';
import { trpc } from '../utils/trpc';
import { 
  AreaChart, Area, 
  BarChart, Bar, 
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// Count-up animation hook
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const startTime = performance.now();
          const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

// Mini sparkline component
function Sparkline({ data, color, width = 80, height = 30 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className="sparkline">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon 
        points={areaPoints} 
        fill={`url(#sg-${color.replace(/[^a-z0-9]/gi, '')})`}
      />
      <polyline 
        points={points} 
        fill="none" 
        stroke={color} 
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle 
        cx={width} 
        cy={parseFloat(points.split(' ').pop()?.split(',')[1] || '0')} 
        r="3" 
        fill={color}
      />
    </svg>
  );
}

// Severity colors
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#eab308',
  low: '#22c55e',
  info: '#64748b',
};

// Trend indicator
function TrendBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  return (
    <div className={`trend-badge ${isPositive ? 'trend-up' : 'trend-down'}`}>
      {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      <span>{Math.abs(value)}%</span>
      <span className="trend-label">{label}</span>
    </div>
  );
}

// Metric card component
function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  trend, 
  trendLabel,
  sparklineData,
  onClick 
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  onClick?: () => void;
}) {
  return (
    <div className="metric-card" onClick={onClick} style={{ '--accent-color': color } as React.CSSProperties}>
      <div className="metric-header">
        <div className="metric-icon" style={{ background: `${color}20`, color }}>
          <Icon size={18} />
        </div>
        {trend !== undefined && <TrendBadge value={trend} label={trendLabel || ''} />}
        <button className="metric-menu" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal size={14} />
        </button>
      </div>
      <div className="metric-body">
        <h3 className="metric-value">{value}</h3>
        <p className="metric-title">{title}</p>
        {subtitle && <p className="metric-subtitle">{subtitle}</p>}
      </div>
      {sparklineData && (
        <div className="metric-sparkline">
          <Sparkline data={sparklineData} color={color} />
        </div>
      )}
    </div>
  );
}

// Vulnerability bar chart
function VulnerabilityDistribution() {
  const data = [
    { severity: 'Critical', count: 3, color: SEVERITY_COLORS.critical },
    { severity: 'High', count: 8, color: SEVERITY_COLORS.high },
    { severity: 'Medium', count: 12, color: SEVERITY_COLORS.medium },
    { severity: 'Low', count: 5, color: SEVERITY_COLORS.low },
  ];

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Security Vulnerabilities</h3>
        <button className="chart-action">
          <RefreshCw size={14} />
        </button>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={11} />
          <YAxis 
            type="category" 
            dataKey="severity" 
            stroke="#64748b" 
            fontSize={11}
            width={60}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ 
              background: '#111118', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Cost trend chart
function CostTrendChart() {
  const data = DEMO_COST_TREND.slice(-14).map((d, i) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: d.cost,
    projected: d.cost * 1.1,
  }));

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>LLM Cost Trend</h3>
        <div className="chart-legend">
          <span className="legend-item"><span className="legend-dot" style={{ background: '#6366f1' }} /> Actual</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#6366f1', opacity: 0.4 }} /> Projected</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
          <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `$${v}`} />
          <Tooltip 
            contentStyle={{ 
              background: '#111118', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
          />
          <Area 
            type="monotone" 
            dataKey="projected" 
            stroke="#6366f1" 
            fill="url(#colorProjected)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Area 
            type="monotone" 
            dataKey="cost" 
            stroke="#6366f1" 
            fill="url(#colorCost)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Model distribution pie chart
function ModelDistribution() {
  const data = [
    { name: 'GPT-4o', value: 287, color: '#6366f1' },
    { name: 'Claude 3.5', value: 134, color: '#22d3ee' },
    { name: 'Gemini 1.5', value: 68, color: '#34d399' },
    { name: 'Others', value: 12, color: '#64748b' },
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3>Cost by Model</h3>
      </div>
      <div className="donut-wrapper">
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                background: '#111118', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-legend">
          {data.map((item, i) => (
            <div key={i} className="donut-legend-item">
              <span className="legend-dot" style={{ background: item.color }} />
              <span className="legend-label">{item.name}</span>
              <span className="legend-value">${item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Live activity feed
function ActivityFeed() {
  const EVT_COLOR: Record<string, string> = {
    vulnerability_found: '#ef4444',
    scan_completed: '#22d3ee',
    agent_killed: '#ef4444',
    cost_spike: '#f59e0b',
    postman_import: '#34d399',
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return `${Math.floor(diffMin / 60)}h ago`;
  };

  return (
    <div className="activity-card">
      <div className="activity-header">
        <div className="activity-title">
          <Activity size={14} />
          <h3>Live Activity</h3>
        </div>
        <span className="live-badge">
          <span className="live-dot" />
          Live
        </span>
      </div>
      <div className="activity-list">
        {DEMO_ACTIVITY.slice(0, 6).map((event: any) => (
          <div key={event.id} className="activity-item">
            <div className="activity-indicator" style={{ background: EVT_COLOR[event.type] || '#64748b' }} />
            <div className="activity-content">
              <p className="activity-title">{event.title}</p>
              <p className="activity-desc">{event.description}</p>
            </div>
            <div className="activity-meta">
              <span className={`severity-badge ${event.severity}`}>{event.severity}</span>
              <span className="activity-time">{formatTime(event.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
      <a href="/activity" className="activity-link">
        View all activity <ChevronRight size={12} />
      </a>
    </div>
  );
}

// Agent status list
function AgentStatus() {
  return (
    <div className="agent-card">
      <div className="agent-header">
        <div className="agent-title">
          <Cpu size={14} />
          <h3>Active Agents</h3>
        </div>
        <span className="agent-count">{DEMO_AGENTS.length} active</span>
      </div>
      <div className="agent-list">
        {DEMO_AGENTS.slice(0, 5).map((agent: any) => (
          <div key={agent.agentId} className="agent-item">
            <div className="agent-status-indicator" />
            <div className="agent-info">
              <p className="agent-id">{agent.agentId}</p>
              <p className="agent-calls">{agent.totalCalls.toLocaleString()} calls</p>
            </div>
            <div className="agent-cost">${agent.totalCost.toFixed(2)}</div>
          </div>
        ))}
      </div>
      <a href="/agent-guard" className="activity-link">
        Manage agents <ChevronRight size={12} />
      </a>
    </div>
  );
}

// Quick actions
function QuickActions() {
  const actions = [
    { label: 'Import Postman', icon: Upload, href: '/postman', color: '#6366f1' },
    { label: 'Run Security Scan', icon: Shield, href: '/security', color: '#ef4444' },
    { label: 'View Shadow APIs', icon: Eye, href: '/shadow-apis', color: '#22d3ee' },
    { label: 'Compliance Check', icon: Lock, href: '/compliance', color: '#34d399' },
  ];

  return (
    <div className="quick-actions-card">
      <h3 className="quick-actions-title">Quick Actions</h3>
      <div className="quick-actions-grid">
        {actions.map((action) => (
          <a key={action.label} href={action.href} className="quick-action-item" style={{ '--action-color': action.color } as React.CSSProperties}>
            <div className="quick-action-icon">
              <action.icon size={18} />
            </div>
            <span>{action.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// Security score gauge
function SecurityScore() {
  const score = 72;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="security-score-card">
      <div className="chart-header">
        <h3>Security Score</h3>
      </div>
      <div className="score-gauge">
        <svg viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="score-value">
          <span className="score-number">{score}</span>
          <span className="score-max">/100</span>
        </div>
      </div>
      <div className="score-label">Moderate Risk</div>
      <a href="/security" className="btn-view-report">
        <Shield size={14} />
        View Full Report
      </a>
    </div>
  );
}

// Main Home Component
export const Home: React.FC = () => {
  const { data: scanData } = trpc.scan.count.useQuery({ workspaceId: 1 }, { enabled: false });
  const { data: critData } = trpc.security.criticalCount.useQuery({ workspaceId: 1 }, { enabled: false });
  const { data: spendData } = trpc.llmCost.monthlyTotal.useQuery({ workspaceId: 1 }, { enabled: false });
  const { data: agentData } = trpc.agentGuard.activeCount.useQuery({ workspaceId: 1 }, { enabled: false });

  const apis = scanData?.total ?? DEMO_STATS.apisScanned;
  const crits = critData?.count ?? DEMO_STATS.criticalVulns;
  const spend = spendData?.totalInr ?? DEMO_STATS.llmSpendInr;
  const agents = agentData?.count ?? DEMO_STATS.agentsProtected;

  const sparkApis = useMemo(() => DEMO_COST_TREND.slice(-10).map((d: any) => d.cost * 2 + 150), []);
  const sparkCost = useMemo(() => DEMO_COST_TREND.slice(-10).map((d: any) => d.cost), []);

  return (
    <div className="home-page">
      {/* Top metrics row */}
      <div className="metrics-grid">
        <MetricCard
          title="Endpoints Monitored"
          value={apis.toLocaleString()}
          subtitle="+12 this week"
          icon={TrendingUp}
          color="#6366f1"
          trend={8}
          trendLabel="vs last week"
          sparklineData={sparkApis}
          onClick={() => {}}
        />
        <MetricCard
          title="LLM Spend"
          value={`₹${spend.toLocaleString()}`}
          subtitle="$220.14 USD"
          icon={DollarSign}
          color="#22d3ee"
          trend={12}
          trendLabel="vs last month"
          sparklineData={sparkCost}
          onClick={() => {}}
        />
        <MetricCard
          title="Critical Vulns"
          value={crits}
          subtitle="Action needed"
          icon={AlertTriangle}
          color="#ef4444"
          trend={-25}
          trendLabel="vs last week"
          onClick={() => {}}
        />
        <MetricCard
          title="Agents Protected"
          value={agents}
          subtitle="4 active now"
          icon={Bot}
          color="#34d399"
          onClick={() => {}}
        />
      </div>

      {/* Charts row */}
      <div className="charts-grid">
        <div className="charts-main">
          <VulnerabilityDistribution />
          <CostTrendChart />
        </div>
        <div className="charts-side">
          <ModelDistribution />
        </div>
      </div>

      {/* Bottom row */}
      <div className="bottom-grid">
        <ActivityFeed />
        <AgentStatus />
        <SecurityScore />
        <QuickActions />
      </div>
    </div>
  );
};

export default Home;
