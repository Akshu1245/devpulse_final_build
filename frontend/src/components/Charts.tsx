// Interactive Charts Component using Recharts
import React, { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Colors
const COLORS = ['#6366f1', '#22d3ee', '#34d399', '#f59e0b', '#ef4444', '#a855f7'];

interface ChartProps {
  data: any[];
  title?: string;
  height?: number;
  className?: string;
}

// Interactive Line Chart
export function InteractiveLineChart({ data, title, height = 300, className = '' }: ChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  return (
    <div className={`chart-container ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} onMouseMove={(e) => e && setActiveIndex(e.activeTooltipIndex ?? null)}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="name" 
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#f8fafc',
            }}
            labelStyle={{ color: '#f8fafc' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#6366f1" 
            strokeWidth={2}
            dot={{ r: 4, fill: '#6366f1' }}
            activeDot={{ r: 6, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Interactive Area Chart
export function InteractiveAreaChart({ data, title, height = 300, className = '' }: ChartProps) {
  return (
    <div className={`chart-container ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#6366f1" 
            fillOpacity={1} 
            fill="url(#colorValue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Interactive Bar Chart
export function InteractiveBarChart({ data, title, height = 300, className = '' }: ChartProps) {
  return (
    <div className={`chart-container ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Interactive Pie Chart
interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

export function InteractivePieChart({ 
  data, 
  title, 
  height = 300, 
  className = '' 
}: { 
  data: PieChartData[]; 
  title?: string; 
  height?: number; 
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  return (
    <div className={`chart-container ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || COLORS[index % COLORS.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                style={{ transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)', transformOrigin: 'center' }}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
          />
          <Legend 
            formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Donut Chart with Center Label
export function DonutChartWithCenter({ 
  data, 
  title, 
  centerLabel, 
  centerValue,
  height = 300, 
  className = '' 
}: { 
  data: PieChartData[]; 
  title?: string;
  centerLabel?: string;
  centerValue?: string;
  height?: number; 
  className?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className={`chart-container ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
            formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, '']}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center Label */}
      <div className="donut-center">
        {centerValue && <div className="donut-value">{centerValue}</div>}
        {centerLabel && <div className="donut-label">{centerLabel}</div>}
      </div>
    </div>
  );
}

// Vulnerability Distribution Chart
export function VulnerabilityChart({ data, title, height = 250 }: { 
  data: { severity: string; count: number }[]; 
  title?: string; 
  height?: number;
}) {
  const severityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f59e0b',
    medium: '#eab308',
    low: '#22c55e',
    info: '#64748b',
  };
  
  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={12} />
          <YAxis 
            type="category" 
            dataKey="severity" 
            stroke="#64748b" 
            fontSize={12}
            width={60}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={severityColors[entry.severity] || '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// LLM Cost Trend Chart
export function CostTrendChart({ data, title, height = 300 }: { 
  data: { date: string; gpt4: number; claude: number; gemini: number }[]; 
  title?: string; 
  height?: number;
}) {
  return (
    <div className="chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorGpt4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorClaude" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorGemini" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
          <YAxis 
            stroke="#64748b" 
            fontSize={12} 
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'rgba(17, 17, 24, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend />
          <Area type="monotone" dataKey="gpt4" name="GPT-4" stroke="#6366f1" fill="url(#colorGpt4)" />
          <Area type="monotone" dataKey="claude" name="Claude" stroke="#22d3ee" fill="url(#colorClaude)" />
          <Area type="monotone" dataKey="gemini" name="Gemini" stroke="#34d399" fill="url(#colorGemini)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default {
  InteractiveLineChart,
  InteractiveAreaChart,
  InteractiveBarChart,
  InteractivePieChart,
  DonutChartWithCenter,
  VulnerabilityChart,
  CostTrendChart,
};
