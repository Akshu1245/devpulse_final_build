import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, Zap, Skull, Download, Filter, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { trpc } from '../utils/trpc';
import { useAuth } from '../_core/hooks/useAuth';

export const ActivityPage: React.FC = () => {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [startDate, setStartDate] = useState('2025-03-01');
  const [endDate, setEndDate] = useState('2025-03-28');
  const [limit, setLimit] = useState(50);

  // FINAL FIX 2: Replace all mocks with real tRPC
  const { data: activityData, isLoading } = trpc.activity.getRecent.useQuery(
    { workspaceId: user?.activeWorkspaceId!, limit, type: filterType === 'All' ? undefined : filterType },
    { enabled: !!user?.activeWorkspaceId }
  );
  const { data: activityStats } = trpc.activity.getStats.useQuery(
    { workspaceId: user?.activeWorkspaceId! },
    { enabled: !!user?.activeWorkspaceId }
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'scan_completed':
        return <Shield className="w-5 h-5 text-blue-600" />;
      case 'vulnerability_found':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'cost_spike':
        return <Zap className="w-5 h-5 text-amber-600" />;
      case 'agent_killed':
        return <Skull className="w-5 h-5 text-red-600" />;
      case 'postman_import':
        return <Download className="w-5 h-5 text-green-600" />;
      default:
        return <Shield className="w-5 h-5 text-gray-600" />;
    }
  };

  const getDotColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#ca8a04';
      default:
        return '#6b7280';
    }
  };

  // FINAL FIX 2: Date grouping logic
  const groupEventsByDate = (events: any[]) => {
    const groups: { [key: string]: any[] } = {};
    events.forEach((event) => {
      const date = new Date(event.createdAt);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

      let dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (date.toDateString() === today.toDateString()) {
        dateLabel = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateLabel = 'Yesterday';
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(event);
    });
    return groups;
  };

  const groupedEvents = useMemo(() => {
    return groupEventsByDate(activityData?.events || []);
  }, [activityData]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Activity Timeline</h1>
        <p className="text-gray-500">Track all security scans, vulnerabilities, and cost events.</p>
      </div>

      {/* FINAL FIX 2: Filter bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setLimit(50); // Reset pagination
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
          >
            <option>All</option>
            <option>scan_completed</option>
            <option>vulnerability_found</option>
            <option>cost_spike</option>
            <option>agent_killed</option>
            <option>postman_import</option>
          </select>
        </div>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
        >
          <option>All Severities</option>
          <option>critical</option>
          <option>high</option>
          <option>medium</option>
          <option>low</option>
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* FINAL FIX 2: Left side (70%) — Chronological event timeline */}
        <div className="lg:col-span-3 space-y-8">
          {Object.entries(groupedEvents).map(([dateLabel, events]) => (
            <div key={dateLabel}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">{dateLabel}</h3>
              <div className="space-y-4">
                {events.map((event: any, i: number) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-4 h-4 rounded-full border-2 border-[#1d4ed8]"
                        style={{ backgroundColor: getDotColor(event.severity) }}
                      />
                      {i < events.length - 1 && <div className="w-0.5 h-16 bg-gray-200 mt-2" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="bg-white p-4 rounded-lg border border-gray-100 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {getActivityIcon(event.type)}
                            <div>
                              <p className="font-bold text-gray-900">{event.title}</p>
                              <p className="text-sm text-gray-600">{event.description}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(event.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`text-xs px-2 py-1 rounded font-bold ${
                            event.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            event.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            event.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {event.severity?.charAt(0).toUpperCase() + event.severity?.slice(1) || 'Info'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* FINAL FIX 2: Load More button */}
          {(activityData?.events?.length || 0) >= limit && (
            <button
              onClick={() => setLimit(limit + 50)}
              className="w-full px-6 py-3 bg-[#1d4ed8] text-white rounded-lg font-bold hover:bg-blue-700 transition-all"
            >
              Load More
            </button>
          )}
        </div>

        {/* FINAL FIX 2: Right side (30%) — Summary panel */}
        <div className="space-y-6">
          {/* Events by type */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Events by Type</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activityStats?.byType || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {(activityStats?.byType || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#1d4ed8', '#dc2626', '#ca8a04', '#16a34a', '#9333ea'][index % 5]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Most active endpoint */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Most Active Endpoint</h3>
            <p className="text-2xl font-black text-[#1d4ed8] font-mono">{activityStats?.mostActiveEndpoint || 'N/A'}</p>
          </div>

          {/* Peak activity hour */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Peak Activity Hours</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityStats?.byHour || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
