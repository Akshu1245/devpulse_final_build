/**
 * DevPulse Onboarding Flow
 * ========================
 * First-run experience for new users
 * 
 * Steps:
 * 1. Welcome & value proposition
 * 2. Connect first API source (Postman/Bruno/OpenAPI)
 * 3. Run first scan
 * 4. View results
 * 5. Set up alerts (optional)
 */

import React, { useState, useEffect } from 'react';

// ============ Types ============

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.FC<StepProps>;
  optional?: boolean;
}

interface StepProps {
  onNext: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  data: OnboardingData;
  setData: (data: Partial<OnboardingData>) => void;
}

interface OnboardingData {
  email?: string;
  workspaceName?: string;
  importSource?: 'postman' | 'bruno' | 'openapi' | 'manual';
  importedEndpoints?: number;
  scanResults?: {
    vulnerabilities: number;
    secrets: number;
    riskScore: number;
  };
  alertEmail?: string;
  slackWebhook?: string;
  budgetLimit?: number;
}

// ============ Step Components ============

const WelcomeStep: React.FC<StepProps> = ({ onNext }) => (
  <div className="onboarding-step welcome">
    <div className="step-icon">🛡️</div>
    <h1>Welcome to DevPulse</h1>
    <p className="step-description">
      API Security & LLM Cost Intelligence in your IDE.
      Let's get you set up in under 2 minutes.
    </p>
    
    <div className="value-props">
      <div className="prop">
        <span className="prop-icon">✓</span>
        <span>Scan APIs for OWASP vulnerabilities</span>
      </div>
      <div className="prop">
        <span className="prop-icon">✓</span>
        <span>Detect exposed secrets and credentials</span>
      </div>
      <div className="prop">
        <span className="prop-icon">✓</span>
        <span>Monitor AI agent costs in real-time</span>
      </div>
      <div className="prop">
        <span className="prop-icon">✓</span>
        <span>Prevent runaway billing with AgentGuard</span>
      </div>
    </div>

    <button className="primary-btn" onClick={onNext}>
      Let's Go →
    </button>
  </div>
);

const ImportStep: React.FC<StepProps> = ({ onNext, onSkip, data, setData }) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(data.importSource || null);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const sources = [
    { id: 'postman', name: 'Postman Collection', icon: '📦', description: 'Import from .json file' },
    { id: 'bruno', name: 'Bruno Collection', icon: '🐻', description: 'Import from folder' },
    { id: 'openapi', name: 'OpenAPI/Swagger', icon: '📄', description: 'Import from .yaml or .json' },
    { id: 'manual', name: 'Enter Manually', icon: '✏️', description: 'Add endpoints one by one' },
  ];

  const handleImport = async () => {
    if (!selectedSource) return;
    
    setImporting(true);
    
    // Simulate import
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setData({
      importSource: selectedSource as OnboardingData['importSource'],
      importedEndpoints: Math.floor(Math.random() * 20) + 5,
    });
    
    setImporting(false);
    onNext();
  };

  return (
    <div className="onboarding-step import">
      <h2>Connect Your APIs</h2>
      <p className="step-description">
        Import your API definitions to start scanning.
      </p>

      <div className="source-grid">
        {sources.map(source => (
          <div
            key={source.id}
            className={`source-card ${selectedSource === source.id ? 'selected' : ''}`}
            onClick={() => setSelectedSource(source.id)}
          >
            <span className="source-icon">{source.icon}</span>
            <span className="source-name">{source.name}</span>
            <span className="source-desc">{source.description}</span>
          </div>
        ))}
      </div>

      {selectedSource && selectedSource !== 'manual' && (
        <div className="file-upload">
          <input
            type="file"
            accept={selectedSource === 'postman' ? '.json' : selectedSource === 'openapi' ? '.json,.yaml,.yml' : '*'}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <p className="file-hint">
            {file ? `Selected: ${file.name}` : 'Drop file here or click to browse'}
          </p>
        </div>
      )}

      <div className="step-actions">
        <button className="secondary-btn" onClick={onSkip}>
          Skip for now
        </button>
        <button 
          className="primary-btn" 
          onClick={handleImport}
          disabled={!selectedSource || importing}
        >
          {importing ? 'Importing...' : 'Import & Continue →'}
        </button>
      </div>
    </div>
  );
};

const ScanStep: React.FC<StepProps> = ({ onNext, data, setData }) => {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'complete'>('idle');

  const runScan = async () => {
    setScanning(true);
    setPhase('scanning');

    // Simulate scan progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgress(i);
    }

    // Set fake results
    setData({
      scanResults: {
        vulnerabilities: Math.floor(Math.random() * 5) + 1,
        secrets: Math.floor(Math.random() * 3),
        riskScore: Math.floor(Math.random() * 40) + 60,
      },
    });

    setScanning(false);
    setPhase('complete');
  };

  return (
    <div className="onboarding-step scan">
      <h2>Run Your First Scan</h2>
      <p className="step-description">
        {data.importedEndpoints 
          ? `We found ${data.importedEndpoints} endpoints. Let's scan them for vulnerabilities.`
          : "Let's scan your workspace for API patterns and security issues."}
      </p>

      {phase === 'idle' && (
        <div className="scan-preview">
          <div className="scan-item">🔍 OWASP Top 10 Vulnerability Scan</div>
          <div className="scan-item">🔐 Secret & Credential Detection</div>
          <div className="scan-item">📊 Risk Score Calculation</div>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="scan-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">Scanning... {progress}%</p>
          <p className="progress-phase">
            {progress < 30 && 'Analyzing API patterns...'}
            {progress >= 30 && progress < 60 && 'Running OWASP checks...'}
            {progress >= 60 && progress < 90 && 'Detecting secrets...'}
            {progress >= 90 && 'Calculating risk score...'}
          </p>
        </div>
      )}

      {phase === 'complete' && data.scanResults && (
        <div className="scan-results">
          <h3>Scan Complete!</h3>
          <div className="results-grid">
            <div className="result-card">
              <span className="result-value">{data.scanResults.vulnerabilities}</span>
              <span className="result-label">Vulnerabilities</span>
            </div>
            <div className="result-card">
              <span className="result-value">{data.scanResults.secrets}</span>
              <span className="result-label">Exposed Secrets</span>
            </div>
            <div className="result-card">
              <span className="result-value">{data.scanResults.riskScore}</span>
              <span className="result-label">Risk Score</span>
            </div>
          </div>
        </div>
      )}

      <div className="step-actions">
        {phase === 'idle' && (
          <button className="primary-btn" onClick={runScan}>
            Start Scan →
          </button>
        )}
        {phase === 'complete' && (
          <button className="primary-btn" onClick={onNext}>
            View Details →
          </button>
        )}
      </div>
    </div>
  );
};

const AlertsStep: React.FC<StepProps> = ({ onNext, onSkip, data, setData }) => {
  const [email, setEmail] = useState(data.alertEmail || '');
  const [slack, setSlack] = useState(data.slackWebhook || '');
  const [budget, setBudget] = useState(data.budgetLimit?.toString() || '50');

  const handleSave = () => {
    setData({
      alertEmail: email || undefined,
      slackWebhook: slack || undefined,
      budgetLimit: parseFloat(budget) || 50,
    });
    onNext();
  };

  return (
    <div className="onboarding-step alerts">
      <h2>Set Up Alerts</h2>
      <p className="step-description">
        Get notified about security issues and budget warnings.
      </p>

      <div className="form-group">
        <label>Email Alerts</label>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Slack Webhook (optional)</label>
        <input
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Daily Budget Limit ($)</label>
        <input
          type="number"
          placeholder="50"
          min="1"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <p className="form-hint">
          AgentGuard will alert you when AI agents approach this limit.
        </p>
      </div>

      <div className="step-actions">
        <button className="secondary-btn" onClick={onSkip}>
          Skip for now
        </button>
        <button className="primary-btn" onClick={handleSave}>
          Save & Continue →
        </button>
      </div>
    </div>
  );
};

const CompleteStep: React.FC<StepProps> = ({ data }) => (
  <div className="onboarding-step complete">
    <div className="step-icon success">✅</div>
    <h1>You're All Set!</h1>
    <p className="step-description">
      DevPulse is now protecting your APIs and monitoring your AI costs.
    </p>

    <div className="summary">
      <h3>What we set up:</h3>
      <ul>
        {data.importedEndpoints && (
          <li>✓ Imported {data.importedEndpoints} API endpoints</li>
        )}
        {data.scanResults && (
          <li>✓ Initial scan complete (Risk Score: {data.scanResults.riskScore})</li>
        )}
        {data.alertEmail && (
          <li>✓ Email alerts configured</li>
        )}
        {data.budgetLimit && (
          <li>✓ Daily budget limit: ${data.budgetLimit}</li>
        )}
      </ul>
    </div>

    <div className="next-steps">
      <h3>Recommended Next Steps:</h3>
      <div className="next-step-card" onClick={() => window.location.href = '/security'}>
        <span className="next-icon">🛡️</span>
        <span className="next-text">Review Security Findings</span>
      </div>
      <div className="next-step-card" onClick={() => window.location.href = '/costs'}>
        <span className="next-icon">💰</span>
        <span className="next-text">Set Up Cost Tracking</span>
      </div>
      <div className="next-step-card" onClick={() => window.location.href = '/agentguard'}>
        <span className="next-icon">🤖</span>
        <span className="next-text">Configure AgentGuard</span>
      </div>
    </div>

    <button className="primary-btn" onClick={() => window.location.href = '/dashboard'}>
      Go to Dashboard →
    </button>
  </div>
);

// ============ Main Component ============

const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started', component: WelcomeStep },
  { id: 'import', title: 'Import', description: 'Connect APIs', component: ImportStep, optional: true },
  { id: 'scan', title: 'Scan', description: 'First scan', component: ScanStep },
  { id: 'alerts', title: 'Alerts', description: 'Set up alerts', component: AlertsStep, optional: true },
  { id: 'complete', title: 'Complete', description: 'All done', component: CompleteStep },
];

export const OnboardingPage: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>({});

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const StepComponent = currentStep.component;

  const goNext = () => {
    if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const skipStep = () => {
    goNext();
  };

  const updateData = (newData: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...newData }));
  };

  // Check if user has completed onboarding before
  useEffect(() => {
    const completed = localStorage.getItem('devpulse_onboarding_complete');
    if (completed === 'true') {
      window.location.href = '/dashboard';
    }
  }, []);

  // Mark onboarding as complete when reaching the final step
  useEffect(() => {
    if (currentStep.id === 'complete') {
      localStorage.setItem('devpulse_onboarding_complete', 'true');
    }
  }, [currentStep.id]);

  return (
    <div className="onboarding-page">
      <div className="onboarding-sidebar">
        <div className="sidebar-brand">🛡️ DevPulse</div>
        <div className="step-indicators">
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`step-indicator ${index === currentStepIndex ? 'active' : ''} ${index < currentStepIndex ? 'completed' : ''}`}
            >
              <div className="indicator-dot">
                {index < currentStepIndex ? '✓' : index + 1}
              </div>
              <div className="indicator-text">
                <span className="indicator-title">{step.title}</span>
                <span className="indicator-desc">{step.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="onboarding-content">
        <StepComponent
          onNext={goNext}
          onBack={goBack}
          onSkip={skipStep}
          data={data}
          setData={updateData}
        />
      </div>
    </div>
  );
};

export default OnboardingPage;

// ============ CSS ============

export const onboardingStyles = `
.onboarding-page {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
  background: #f8f9fa;
}

.onboarding-sidebar {
  background: #1a1a2e;
  color: white;
  padding: 2rem;
}

.sidebar-brand {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 3rem;
}

.step-indicators {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 1rem;
  opacity: 0.5;
}

.step-indicator.active,
.step-indicator.completed {
  opacity: 1;
}

.indicator-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.step-indicator.active .indicator-dot {
  background: #4CAF50;
}

.step-indicator.completed .indicator-dot {
  background: #4CAF50;
}

.onboarding-content {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.onboarding-step {
  max-width: 600px;
  text-align: center;
}

.step-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.step-description {
  color: #666;
  margin-bottom: 2rem;
}

.value-props {
  text-align: left;
  margin: 2rem 0;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.prop {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
}

.prop-icon {
  color: #4CAF50;
  font-weight: bold;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin: 2rem 0;
}

.source-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s;
}

.source-card:hover {
  border-color: #ddd;
}

.source-card.selected {
  border-color: #4CAF50;
  background: #f0fff0;
}

.source-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.source-name {
  font-weight: 600;
  display: block;
}

.source-desc {
  color: #888;
  font-size: 0.9rem;
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

.primary-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.secondary-btn {
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
  padding: 1rem 2rem;
  border-radius: 8px;
  cursor: pointer;
}

.progress-bar {
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
  margin: 2rem 0;
}

.progress-fill {
  height: 100%;
  background: #4CAF50;
  transition: width 0.3s;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 2rem 0;
}

.result-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.result-value {
  font-size: 2rem;
  font-weight: bold;
  color: #1a1a2e;
  display: block;
}

.result-label {
  color: #888;
  font-size: 0.9rem;
}

.form-group {
  text-align: left;
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
}

.form-hint {
  color: #888;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.next-steps {
  margin: 2rem 0;
}

.next-step-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.next-step-card:hover {
  transform: translateX(5px);
}

.next-icon {
  font-size: 1.5rem;
}
`;
