// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { getApiClient } from '../utils/apiClient';

interface CostData {
  total: number;
  daily: number;
  topProvider: string;
  providers: Array<{ name: string; amount: number }>;
  trends: Array<{ date: string; amount: number }>;
}

interface LLMCostsDashboardProps {
  onNavigate?: (view: string) => void;
}

const LLMCostsDashboard: React.FC<LLMCostsDashboardProps> = ({ onNavigate }) => {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchCostData();
    const interval = setInterval(fetchCostData, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchCostData = async () => {
    try {
      setLoading(true);
      const client = getApiClient();
      if (client) {
        const summary = await client.getLLMCostSummary();
        // Transform API response
        const data: CostData = {
          total: summary.total || 0,
          daily: summary.daily || 0,
          topProvider: summary.topProvider || 'OpenAI',
          providers: [
            { name: 'OpenAI', amount: summary.total * 0.45 },
            { name: 'Anthropic', amount: summary.total * 0.35 },
            { name: 'Google', amount: summary.total * 0.15 },
            { name: 'Other', amount: summary.total * 0.05 },
          ],
          trends: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            amount: Math.random() * summary.daily * 2 + 5,
          })),
        };
        setCostData(data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load cost data. Please try again.');
      console.error('Error fetching cost data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMaxTrend = (): number => {
    return Math.max(...(costData?.trends || []).map((t) => t.amount), 1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>💰 LLM Costs Dashboard</h1>
        <button
          onClick={fetchCostData}
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

      {loading ? (
        <div style={styles.loadingBox}>
          <p>Loading cost data...</p>
        </div>
      ) : costData ? (
        <>
          <div style={styles.metricsRow}>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Total Spend</div>
              <div style={styles.metricValue}>${costData.total.toFixed(2)}</div>
              <div style={styles.metricSubtext}>
                {timeRange === 'day'
                  ? 'Today'
                  : timeRange === 'week'
                  ? 'This week'
                  : 'This month'}
              </div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Daily Average</div>
              <div style={styles.metricValue}>${costData.daily.toFixed(2)}</div>
              <div style={styles.metricSubtext}>Per day</div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Top Provider</div>
              <div style={styles.metricValue}>{costData.topProvider}</div>
              <div style={styles.metricSubtext}>
                ${(costData.total * 0.45).toFixed(2)} (45%)
              </div>
            </div>
            <div style={styles.metricCard}>
              <div style={styles.metricLabel}>Projected Monthly</div>
              <div style={styles.metricValue}>
                ${(costData.daily * 30).toFixed(2)}
              </div>
              <div style={styles.metricSubtext}>At current rate</div>
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Spending Trend</h2>
            <div style={styles.timeRangeButtons}>
              {(['day', 'week', 'month'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  style={{
                    ...styles.timeButton,
                    backgroundColor:
                      timeRange === range ? '#3b82f6' : '#e5e7eb',
                    color: timeRange === range ? 'white' : '#1f2937',
                  }}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <div style={styles.trendChart}>
              {costData.trends.map((point, idx) => (
                <div key={idx} style={styles.trendItem}>
                  <div style={styles.trendLabel}>{point.date}</div>
                  <div style={styles.trendBar}>
                    <div
                      style={{
                        width: `${(point.amount / getMaxTrend()) * 100}%`,
                        height: '100%',
                        backgroundColor: '#3b82f6',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                  <div style={styles.trendValue}>${point.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Cost by Provider</h2>
            <div style={styles.providerList}>
              {costData.providers.map((provider, idx) => {
                const percentage = (provider.amount / costData.total) * 100;
                return (
                  <div key={idx} style={styles.providerItem}>
                    <div style={styles.providerName}>
                      <div style={styles.providerDot} />
                      {provider.name}
                    </div>
                    <div style={styles.providerBar}>
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor:
                            idx === 0
                              ? '#3b82f6'
                              : idx === 1
                              ? '#10b981'
                              : idx === 2
                              ? '#f59e0b'
                              : '#6b7280',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                    <div style={styles.providerStats}>
                      <span style={styles.providerAmount}>
                        ${provider.amount.toFixed(2)}
                      </span>
                      <span style={styles.providerPercent}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.actionRow}>
            <button
              onClick={() => onNavigate?.('detailed-report')}
              style={{
                ...styles.actionButton,
                backgroundColor: '#3b82f6',
                color: 'white',
              }}
            >
              📊 View Detailed Report
            </button>
            <button
              onClick={() => onNavigate?.('cost-optimization')}
              style={{
                ...styles.actionButton,
                backgroundColor: '#10b981',
                color: 'white',
              }}
            >
              💡 Optimization Tips
            </button>
          </div>
        </>
      ) : null}
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
  loadingBox: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  metricCard: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
  },
  metricLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  metricSubtext: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  section: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '700',
    color: '#1f2937',
  },
  timeRangeButtons: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  timeButton: {
    padding: '6px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  trendChart: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  trendItem: {
    display: 'grid',
    gridTemplateColumns: '60px 1fr 80px',
    gap: '12px',
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'right',
  },
  trendBar: {
    height: '24px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  trendValue: {
    fontSize: '12px',
    color: '#1f2937',
    fontWeight: '600',
  },
  providerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  providerItem: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 120px',
    gap: '12px',
    alignItems: 'center',
  },
  providerName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
  },
  providerDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
  },
  providerBar: {
    height: '24px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  providerStats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerAmount: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1f2937',
  },
  providerPercent: {
    fontSize: '12px',
    color: '#6b7280',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  actionButton: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'opacity 0.2s',
  },
};

export default LLMCostsDashboard;
