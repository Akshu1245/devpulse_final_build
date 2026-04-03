import React, { useState, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { AlertCircle, Skull, Play, Pause } from 'lucide-react';

export const AgentGuardPage: React.FC = () => {
  const [demoActive, setDemoActive] = useState(false);
  const [demoSpend, setDemoSpend] = useState(0);
  const [demoKilled, setDemoKilled] = useState(false);
  const [demoIncidents, setDemoIncidents] = useState<any[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [demoStartTime, setDemoStartTime] = useState<number | null>(null);

  // Check if demo mode is enabled
  const isDemoMode = process.env.NODE_ENV === 'development' || new URLSearchParams(window.location.search).get('demo') === 'true';

  // POLISH 1: Run Kill Switch Demo Button
  useEffect(() => {
    if (!demoActive || demoKilled) return;

    const interval = setInterval(() => {
      setDemoSpend((prev) => {
        const newSpend = prev + Math.random() * (8 - 3) + 3; // Random ₹3-8 increment
        
        if (newSpend >= 150) {
          // Agent killed at ₹150 threshold
          setDemoKilled(true);
          const elapsedSeconds = demoStartTime ? Math.floor((Date.now() - demoStartTime) / 1000) : 0;
          setNotificationMessage(`🚨 Rogue Agent Killed — DevPulse saved ₹${newSpend.toFixed(2)} in ${elapsedSeconds}s`);
          setShowNotification(true);
          
          // Add incident entry
          setDemoIncidents((prev) => [
            {
              id: Date.now(),
              agentId: 'rogue-agent-demo',
              action: 'killed',
              reason: 'Budget threshold exceeded',
              spentAmount: newSpend.toFixed(2),
              timestamp: new Date().toLocaleTimeString(),
            },
            ...prev,
          ]);

          setTimeout(() => setShowNotification(false), 5000);
          return newSpend;
        }
        
        return newSpend;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [demoActive, demoKilled, demoStartTime]);

  const handleStartDemo = () => {
    setDemoActive(true);
    setDemoKilled(false);
    setDemoSpend(0);
    setDemoStartTime(Date.now());
    setDemoIncidents([]);
  };

  const handleStopDemo = () => {
    setDemoActive(false);
    setDemoKilled(false);
    setDemoSpend(0);
    setDemoStartTime(null);
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AgentGuard</h1>
          <p className="text-gray-500">Autonomous agent monitoring and kill switch.</p>
        </div>
        {isDemoMode && (
          <button
            onClick={demoActive ? handleStopDemo : handleStartDemo}
            className={`px-6 py-3 rounded-lg font-bold text-white flex items-center gap-2 transition-all ${
              demoActive ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1d4ed8] hover:bg-blue-700'
            }`}
          >
            {demoActive ? (
              <>
                <Pause className="w-5 h-5" />
                Stop Demo
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                🚀 Run Kill Switch Demo
              </>
            )}
          </button>
        )}
      </div>

      {/* POLISH 1: Live Demo Section */}
      {isDemoMode && demoActive && (
        <div className="bg-white p-8 rounded-2xl border-2 border-red-200 shadow-lg">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">LIVE SPEND RATE</p>
                <p className="text-5xl font-black text-red-600">₹{demoSpend.toFixed(2)}</p>
              </div>
              <div className={`px-6 py-3 rounded-full font-bold text-white text-lg flex items-center gap-2 ${
                demoKilled ? 'bg-green-600 animate-none' : 'bg-red-600 animate-pulse'
              }`}>
                {demoKilled ? '✓ KILLED BY AGENTGUARD' : '🔴 AGENT ACTIVE'}
              </div>
            </div>

            {demoKilled && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-green-800 font-bold">Agent successfully terminated at ₹150 threshold</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed bottom-8 right-8 bg-red-600 text-white p-6 rounded-xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-w-md">
          <p className="font-bold text-lg">{notificationMessage}</p>
        </div>
      )}

      {/* Active Agents */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Active Agents</h2>
        <div className="space-y-4">
          {demoIncidents.length === 0 ? (
            <p className="text-gray-500">No active agents at the moment.</p>
          ) : (
            demoIncidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4">
                  <Skull className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="font-bold text-gray-900">{incident.agentId}</p>
                    <p className="text-sm text-gray-500">{incident.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">₹{incident.spentAmount}</p>
                  <p className="text-xs text-gray-500">{incident.timestamp}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Incident History</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-bold text-gray-900">Agent ID</th>
                <th className="text-left py-3 px-4 font-bold text-gray-900">Action</th>
                <th className="text-left py-3 px-4 font-bold text-gray-900">Reason</th>
                <th className="text-left py-3 px-4 font-bold text-gray-900">Amount Spent</th>
                <th className="text-left py-3 px-4 font-bold text-gray-900">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {demoIncidents.map((incident) => (
                <tr key={incident.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{incident.agentId}</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                      {incident.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{incident.reason}</td>
                  <td className="py-3 px-4 font-bold text-red-600">₹{incident.spentAmount}</td>
                  <td className="py-3 px-4 text-gray-500">{incident.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
