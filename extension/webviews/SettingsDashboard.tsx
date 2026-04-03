import React, { useState, useEffect } from 'react';

interface Settings {
  apiUrl: string;
  apiKey: string;
  workspaceId: string;
  refreshInterval: number;
  autoScanOnSave: boolean;
  scanOnOpen: boolean;
  showStatusBar: boolean;
  alertSeverity: 'critical' | 'high' | 'medium' | 'low';
}

interface SettingsDashboardProps {
  onSave?: (settings: Settings) => void;
  onTestConnection?: () => Promise<boolean>;
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({ onSave, onTestConnection }) => {
  const [settings, setSettings] = useState<Settings>({
    apiUrl: 'http://localhost:3000',
    apiKey: '',
    workspaceId: '123',
    refreshInterval: 30000,
    autoScanOnSave: false,
    scanOnOpen: false,
    showStatusBar: true,
    alertSeverity: 'high',
  });

  const [originalSettings, setOriginalSettings] = useState<Settings>(settings);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [changesSaved, setChangesSaved] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    // In a real app, load from VS Code settings
    // For now, use default values
  };

  const handleSettingChange = (key: keyof Settings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setChangesSaved(false);
  };

  const handleSaveSettings = () => {
    onSave?.(settings);
    setOriginalSettings(settings);
    setChangesSaved(true);
  };

  const handleTestConnection = async () => {
    try {
      setTestResult({ status: 'testing', message: 'Testing connection...' });
      const success = await onTestConnection?.();
      if (success) {
        setTestResult({
          status: 'success',
          message: 'Connection successful! ✓',
        });
      } else {
        setTestResult({
          status: 'error',
          message: 'Connection failed. Please check your settings.',
        });
      }
    } catch (err) {
      setTestResult({
        status: 'error',
        message: 'Connection error. Please try again.',
      });
    }
    setTimeout(() => setTestResult({ status: 'idle', message: '' }), 5000);
  };

  const handleResetSettings = () => {
    setSettings(originalSettings);
    setChangesSaved(true);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>⚙️ DevPulse Settings</h1>
        <div style={styles.headerInfo}>
          {!changesSaved && (
            <span style={styles.unsavedIndicator}>● Unsaved changes</span>
          )}
        </div>
      </div>

      <div style={styles.content}>
        {/* Connection Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🔌 Connection Settings</h2>
          <div style={styles.formGroup}>
            <label style={styles.label}>API URL</label>
            <input
              type="text"
              value={settings.apiUrl}
              onChange={(e) => handleSettingChange('apiUrl', e.target.value)}
              style={styles.input}
              placeholder="https://api.devpulse.in"
            />
            <p style={styles.help}>
              The base URL for your DevPulse backend API
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>API Key</label>
            <div style={styles.inputWrapper}>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                style={styles.input}
                placeholder="Enter your API key"
              />
              <button
                style={{
                  ...styles.iconButton,
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                👁
              </button>
            </div>
            <p style={styles.help}>
              Your DevPulse API key for authentication (stored securely)
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Workspace ID</label>
            <input
              type="text"
              value={settings.workspaceId}
              onChange={(e) => handleSettingChange('workspaceId', e.target.value)}
              style={styles.input}
              placeholder="123456"
            />
            <p style={styles.help}>
              Your workspace identifier for API requests
            </p>
          </div>

          <div style={styles.testConnection}>
            <button
              onClick={handleTestConnection}
              style={{
                ...styles.button,
                backgroundColor: '#3b82f6',
                color: 'white',
              }}
              disabled={testResult.status === 'testing'}
            >
              {testResult.status === 'testing' ? '⟳ Testing...' : '🔗 Test Connection'}
            </button>
            {testResult.message && (
              <span
                style={{
                  ...styles.testMessage,
                  color:
                    testResult.status === 'success' ? '#10b981' : '#ef4444',
                }}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </section>

        {/* Refresh Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🔄 Refresh & Performance</h2>
          <div style={styles.formGroup}>
            <label style={styles.label}>Refresh Interval (ms)</label>
            <input
              type="number"
              value={settings.refreshInterval}
              onChange={(e) =>
                handleSettingChange('refreshInterval', parseInt(e.target.value))
              }
              style={styles.input}
              min="5000"
              step="5000"
            />
            <p style={styles.help}>
              How often to refresh dashboard data (5000ms = 5 seconds)
            </p>
          </div>
        </section>

        {/* Scan Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🔍 Scan Settings</h2>
          <div style={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="autoScanOnSave"
              checked={settings.autoScanOnSave}
              onChange={(e) =>
                handleSettingChange('autoScanOnSave', e.target.checked)
              }
              style={styles.checkbox}
            />
            <label htmlFor="autoScanOnSave" style={styles.checkboxLabel}>
              Auto-scan on file save
            </label>
            <p style={styles.help}>
              Automatically run security scan when saving files
            </p>
          </div>

          <div style={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="scanOnOpen"
              checked={settings.scanOnOpen}
              onChange={(e) => handleSettingChange('scanOnOpen', e.target.checked)}
              style={styles.checkbox}
            />
            <label htmlFor="scanOnOpen" style={styles.checkboxLabel}>
              Scan on workspace open
            </label>
            <p style={styles.help}>
              Run initial security scan when opening a workspace
            </p>
          </div>
        </section>

        {/* Display Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>👁 Display Settings</h2>
          <div style={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="showStatusBar"
              checked={settings.showStatusBar}
              onChange={(e) =>
                handleSettingChange('showStatusBar', e.target.checked)
              }
              style={styles.checkbox}
            />
            <label htmlFor="showStatusBar" style={styles.checkboxLabel}>
              Show status bar
            </label>
            <p style={styles.help}>
              Display DevPulse status in the VS Code status bar
            </p>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Alert Severity</label>
            <select
              value={settings.alertSeverity}
              onChange={(e) =>
                handleSettingChange(
                  'alertSeverity',
                  e.target.value as 'critical' | 'high' | 'medium' | 'low'
                )
              }
              style={styles.select}
            >
              <option value="critical">🔴 Critical only</option>
              <option value="high">🟠 Critical + High</option>
              <option value="medium">🟡 Critical + High + Medium</option>
              <option value="low">🟢 All severities</option>
            </select>
            <p style={styles.help}>
              Which alert severities to show in notifications
            </p>
          </div>
        </section>

        {/* Action Buttons */}
        <div style={styles.actionRow}>
          <button
            onClick={handleSaveSettings}
            disabled={changesSaved}
            style={{
              ...styles.button,
              backgroundColor: changesSaved ? '#d1d5db' : '#10b981',
              color: 'white',
            }}
          >
            💾 Save Settings
          </button>
          <button
            onClick={handleResetSettings}
            disabled={changesSaved}
            style={{
              ...styles.button,
              backgroundColor: changesSaved ? '#d1d5db' : '#ef4444',
              color: 'white',
            }}
          >
            ↻ Reset
          </button>
        </div>

        {/* Info Section */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>ℹ️ Information</h2>
          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              📚 <strong>Documentation:</strong> Visit our docs for more information about connecting DevPulse to your workspace
            </p>
            <p style={styles.infoText}>
              🆘 <strong>Support:</strong> Need help? Contact support@devpulse.in
            </p>
            <p style={styles.infoText}>
              🔐 <strong>Security:</strong> Your API key is stored securely in VS Code's secret storage and never sent to third parties
            </p>
          </div>
        </section>
      </div>
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
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  unsavedIndicator: {
    fontSize: '12px',
    color: '#f59e0b',
    fontWeight: '600',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#1f2937',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: '"Segoe UI", sans-serif',
  } as React.CSSProperties,
  inputWrapper: {
    position: 'relative',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: '"Segoe UI", sans-serif',
  } as React.CSSProperties,
  help: {
    margin: '6px 0 0 0',
    fontSize: '12px',
    color: '#6b7280',
  },
  checkboxGroup: {
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    marginRight: '8px',
  },
  checkboxLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    cursor: 'pointer',
    display: 'inline-block',
  },
  testConnection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f3f4f6',
  },
  button: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '8px',
  },
  testMessage: {
    fontSize: '13px',
    fontWeight: '600',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
  },
  infoBox: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
  },
  infoText: {
    margin: '8px 0',
    fontSize: '13px',
    color: '#374151',
  },
};

export default SettingsDashboard;
