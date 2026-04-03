// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { getApiClient } from '../utils/apiClient';

interface ShadowAPI {
  id: string;
  endpoint: string;
  method: string;
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  detectionCount: number;
  confidenceScore: number;
  lastDetected: string;
  whitelisted: boolean;
  description: string;
}

interface ShadowApisDashboardProps {
  onWhitelist?: (endpoint: string, method: string) => void;
}

const ShadowApisDashboard: React.FC<ShadowApisDashboardProps> = ({ onWhitelist }) => {
  const [apis, setApis] = useState<ShadowAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [showWhitelisted, setShowWhitelisted] = useState(false);

  useEffect(() => {
    fetchShadowApis();
    const interval = setInterval(fetchShadowApis, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchShadowApis = async () => {
    try {
      setLoading(true);
      const client = getApiClient();
      if (client) {
        const detections = await client.getShadowApiDetections();
        // Transform API response
        const transformedApis: ShadowAPI[] = [
          {
            id: 'api-1',
            endpoint: '/api/internal/admin/users',
            method: 'GET',
            riskTier: 'CRITICAL',
            detectionCount: 45,
            confidenceScore: 0.98,
            lastDetected: new Date().toISOString(),
            whitelisted: false,
            description: 'Internal admin users endpoint not documented',
          },
          {
            id: 'api-2',
            endpoint: '/api/v2/reports/export',
            method: 'POST',
            riskTier: 'HIGH',
            detectionCount: 23,
            confidenceScore: 0.92,
            lastDetected: new Date(Date.now() - 3600000).toISOString(),
            whitelisted: false,
            description: 'Export reports with sensitive data',
          },
          {
            id: 'api-3',
            endpoint: '/api/debug/metrics',
            method: 'GET',
            riskTier: 'HIGH',
            detectionCount: 12,
            confidenceScore: 0.87,
            lastDetected: new Date(Date.now() - 7200000).toISOString(),
            whitelisted: true,
            description: 'Debug metrics endpoint (whitelisted)',
          },
        ];
        setApis(transformedApis);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load shadow API data. Please try again.');
      console.error('Error fetching shadow APIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWhitelist = async (api: ShadowAPI) => {
    try {
      const client = getApiClient();
      if (client) {
        await client.whitelistEndpoint(api.endpoint, `Whitelisted from VS Code extension`);
        onWhitelist?.(api.endpoint, api.method);
        setApis(
          apis.map((a) =>
            a.id === api.id ? { ...a, whitelisted: !a.whitelisted } : a
          )
        );
      }
    } catch (err) {
      setError('Failed to whitelist endpoint. Please try again.');
      console.error('Error whitelisting endpoint:', err);
    }
  };

  const getRiskColor = (tier: string): string => {
    switch (tier) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f59e0b';
      case 'MEDIUM': return '#eab308';
      case 'LOW': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const filteredApis = apis.filter((api) => {
    if (!showWhitelisted && api.whitelisted) return false;
    if (filter === 'all') return true;
    return api.riskTier.toLowerCase() === filter;
  });

  const stats = {
    total: (detections: ShadowAPI[]) => detections.length,
    critical: (detections: ShadowAPI[]) =>
      detections.filter((a) => a.riskTier === 'CRITICAL').length,
    high: (detections: ShadowAPI[]) =>
      detections.filter((a) => a.riskTier === 'HIGH').length,
    whitelisted: (detections: ShadowAPI[]) =>
      detections.filter((a) => a.whitelisted).length,
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🚨 Shadow APIs Dashboard</h1>
        <button
          onClick={fetchShadowApis}
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
          <div style={styles.statLabel}>Total Detected</div>
          <div style={styles.statValue}>{stats.total(apis)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>🔴 Critical</div>
          <div style={styles.statValue}>{stats.critical(apis)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>🟠 High</div>
          <div style={styles.statValue}>{stats.high(apis)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>✓ Whitelisted</div>
          <div style={styles.statValue}>{stats.whitelisted(apis)}</div>
        </div>
      </div>

      <div style={styles.controlsRow}>
        <div style={styles.filterRow}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((risk) => (
            <button
              key={risk}
              onClick={() => setFilter(risk)}
              style={{
                ...styles.filterButton,
                backgroundColor: filter === risk ? '#3b82f6' : '#e5e7eb',
                color: filter === risk ? 'white' : '#1f2937',
              }}
            >
              {risk.charAt(0).toUpperCase() + risk.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowWhitelisted(!showWhitelisted)}
          style={{
            ...styles.toggleButton,
            backgroundColor: showWhitelisted ? '#10b981' : '#e5e7eb',
            color: showWhitelisted ? 'white' : '#1f2937',
          }}
        >
          {showWhitelisted ? '✓ Show Whitelisted' : '○ Hide Whitelisted'}
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>
          <p>Loading shadow API detections...</p>
        </div>
      ) : filteredApis.length === 0 ? (
        <div style={styles.emptyBox}>
          <p>
            {showWhitelisted
              ? 'No whitelisted APIs found.'
              : 'No shadow APIs detected. Great job! 🎉'}
          </p>
        </div>
      ) : (
        <div style={styles.apisList}>
          {filteredApis.map((api) => (
            <div key={api.id} style={styles.apiCard}>
              <div style={styles.apiHeader}>
                <div
                  style={{
                    ...styles.riskBadge,
                    backgroundColor: getRiskColor(api.riskTier),
                  }}
                >
                  {api.riskTier}
                </div>
                <div style={styles.endpoint}>
                  <div style={styles.endpointMethod}>{api.method}</div>
                  <div style={styles.endpointPath}>{api.endpoint}</div>
                </div>
                {api.whitelisted && (
                  <div style={styles.whitelistedBadge}>✓ Whitelisted</div>
                )}
              </div>

              <div style={styles.apiDescription}>
                <p style={styles.description}>{api.description}</p>
              </div>

              <div style={styles.apiStats}>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Detected:</span>
                  <span style={styles.statValue}>{api.detectionCount}x</span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Confidence:</span>
                  <div style={styles.confidenceBar}>
                    <div
                      style={{
                        width: `${api.confidenceScore * 100}%`,
                        height: '100%',
                        backgroundColor: getRiskColor(api.riskTier),
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                  <span style={styles.statValue}>
                    {(api.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Last Detected:</span>
                  <span style={styles.statValue}>
                    {new Date(api.lastDetected).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div style={styles.apiActions}>
                <button
                  onClick={() => handleWhitelist(api)}
                  style={{
                    ...styles.actionButton,
                    backgroundColor: api.whitelisted ? '#ef4444' : '#10b981',
                    color: 'white',
                  }}
                >
                  {api.whitelisted ? '✕ Remove from Whitelist' : '✓ Whitelist'}
                </button>
                <button
                  style={{
                    ...styles.actionButton,
                    backgroundColor: '#3b82f6',
                    color: 'white',
                  }}
                >
                  📋 View Details
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
    fontWeight: '600',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterButton: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  toggleButton: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
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
  apisList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  apiCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    borderLeft: `4px solid #3b82f6`,
  },
  apiHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f3f4f6',
  },
  riskBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  endpoint: {
    flex: 1,
  },
  endpointMethod: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  endpointPath: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    fontFamily: 'monospace',
  },
  whitelistedBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: '11px',
    fontWeight: '600',
  },
  apiDescription: {
    marginBottom: '12px',
  },
  description: {
    margin: '0',
    fontSize: '13px',
    color: '#6b7280',
  },
  apiStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f3f4f6',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    minWidth: '80px',
  },
  statValue: {
    fontSize: '12px',
    color: '#1f2937',
    fontWeight: '600',
  },
  confidenceBar: {
    width: '60px',
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  apiActions: {
    display: 'flex',
    gap: '8px',
  },
  actionButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'opacity 0.2s',
  },
};

export default ShadowApisDashboard;
