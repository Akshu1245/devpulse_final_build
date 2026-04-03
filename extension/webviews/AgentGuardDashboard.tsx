import React, { useState, useEffect } from 'react';
import { getApiClient } from '../utils/apiClient';

interface Agent {
  id: string;
  name: string;
  status: 'safe' | 'suspicious' | 'rogue';
  incidents: number;
  riskScore: number;
  lastSeen: string;
  actions: string[];
}

interface AgentGuardDashboardProps {
  onAgentAction?: (agentId: string, action: string) => void;
}

const AgentGuardDashboard: React.FC<AgentGuardDashboardProps> = ({ onAgentAction }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'safe' | 'suspicious' | 'rogue'>('all');

  useEffect(() => {
    fetchAgentData();
    const interval = setInterval(fetchAgentData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      const client = getApiClient();
      if (client) {
        const agentStatus = await client.getAgentGuardStatus();
        // Transform API response to Agent format
        const transformedAgents: Agent[] = [
          {
            id: 'agent-1',
            name: 'DataProcessor',
            status: agentStatus.riskScore > 70 ? 'rogue' : agentStatus.riskScore > 40 ? 'suspicious' : 'safe',
            incidents: agentStatus.recentInterventions?.length || 0,
            riskScore: agentStatus.riskScore || 0,
            lastSeen: new Date().toISOString(),
            actions: ['View Logs', 'Kill Agent'],
          },
          {
            id: 'agent-2',
            name: 'APIGateway',
            status: 'safe',
            incidents: 0,
            riskScore: 15,
            lastSeen: new Date().toISOString(),
            actions: ['View Logs'],
          },
        ];
        setAgents(transformedAgents);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load agent data. Please try again.');
      console.error('Error fetching agent data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKillAgent = async (agentId: string) => {
    try {
      const client = getApiClient();
      if (client) {
        await client.killAgent(agentId, 'Killed from VS Code extension');
        onAgentAction?.(agentId, 'killed');
        await fetchAgentData();
      }
    } catch (err) {
      setError('Failed to kill agent. Please try again.');
      console.error('Error killing agent:', err);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'safe': return '#10b981';
      case 'suspicious': return '#f59e0b';
      case 'rogue': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'safe': return '✓';
      case 'suspicious': return '⚠';
      case 'rogue': return '✕';
      default: return '?';
    }
  };

  const filteredAgents = agents.filter(
    (agent) => filter === 'all' || agent.status === filter
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🤖 AgentGuard Dashboard</h1>
        <button
          onClick={fetchAgentData}
          style={{
            ...styles.button,
            backgroundColor: '#3b82f6',
            color: 'white',
          }}
        >
          ⟳ Refresh
        </button>
      </div>

      {error && (
        <div style={styles.errorBox}>
          <p style={styles.errorText}>{error}</p>
        </div>
      )}

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Agents</div>
          <div style={styles.statValue}>{agents.length}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Active Incidents</div>
          <div style={styles.statValue}>
            {agents.reduce((sum, a) => sum + a.incidents, 0)}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Risk Score</div>
          <div style={styles.statValue}>
            {Math.round(agents.reduce((sum, a) => sum + a.riskScore, 0) / Math.max(agents.length, 1))}
          </div>
        </div>
      </div>

      <div style={styles.filterRow}>
        {(['all', 'safe', 'suspicious', 'rogue'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              ...styles.filterButton,
              backgroundColor: filter === status ? '#3b82f6' : '#e5e7eb',
              color: filter === status ? 'white' : '#1f2937',
            }}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loadingBox}>
          <p>Loading agent data...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div style={styles.emptyBox}>
          <p>No agents found for this filter.</p>
        </div>
      ) : (
        <div style={styles.agentsList}>
          {filteredAgents.map((agent) => (
            <div key={agent.id} style={styles.agentCard}>
              <div style={styles.agentHeader}>
                <div style={styles.agentName}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(agent.status),
                      color: 'white',
                      textAlign: 'center',
                      lineHeight: '24px',
                      marginRight: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {getStatusIcon(agent.status)}
                  </span>
                  {agent.name}
                </div>
                <div style={styles.agentStatus}>{agent.status.toUpperCase()}</div>
              </div>

              <div style={styles.agentDetails}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Incidents:</span>
                  <span style={styles.detailValue}>{agent.incidents}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Risk Score:</span>
                  <div style={styles.riskBar}>
                    <div
                      style={{
                        width: `${Math.min(agent.riskScore, 100)}%`,
                        height: '100%',
                        backgroundColor: getStatusColor(agent.status),
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <span style={styles.detailValue}>{agent.riskScore}/100</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Last Seen:</span>
                  <span style={styles.detailValue}>
                    {new Date(agent.lastSeen).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div style={styles.agentActions}>
                {agent.status !== 'safe' && (
                  <button
                    onClick={() => handleKillAgent(agent.id)}
                    style={{
                      ...styles.actionButton,
                      backgroundColor: '#ef4444',
                      color: 'white',
                    }}
                  >
                    ✕ Kill Agent
                  </button>
                )}
                <button
                  style={{
                    ...styles.actionButton,
                    backgroundColor: '#3b82f6',
                    color: 'white',
                  }}
                >
                  📋 View Logs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    backgroundColor: '#f9fafb',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    margin: '0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
  },
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '12px',
    marginBottom: '16px',
  },
  errorText: {
    color: '#991b1b',
    margin: '0',
    fontSize: '14px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1f2937',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  filterButton: {
    padding: '8px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  loadingBox: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  emptyBox: {
    textAlign: 'center',
    padding: '40px',
    color: '#9ca3af',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  agentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  agentCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
  },
  agentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '12px',
  },
  agentName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
  },
  agentStatus: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
  },
  agentDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  detailLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#6b7280',
    minWidth: '100px',
  },
  detailValue: {
    fontSize: '13px',
    color: '#1f2937',
  },
  riskBar: {
    width: '100px',
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  agentActions: {
    display: 'flex',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
  },
  actionButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'opacity 0.2s',
  },
};

export default AgentGuardDashboard;
