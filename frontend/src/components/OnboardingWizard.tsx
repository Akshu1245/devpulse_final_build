/**
 * DevPulse Onboarding Wizard
 * 
 * Step-by-step onboarding flow for new users.
 */

import React, { useState } from 'react';
import './OnboardingWizard.css';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
  userEmail?: string;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkip,
  userEmail,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    workspaceName: '',
    projectType: '',
    scanFrequency: 'daily',
    notifications: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to DevPulse',
      description: "Let's set up your API security monitoring in just a few steps.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" stroke="#2563EB" strokeWidth="2" />
          <path d="M32 18v14l10 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="32" r="4" fill="#2563EB" />
        </svg>
      ),
      content: <WelcomeContent userEmail={userEmail} />,
    },
    {
      id: 'workspace',
      title: 'Create Your Workspace',
      description: 'A workspace organizes your projects and team members.',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="12" y="16" width="40" height="32" rx="4" stroke="#2563EB" strokeWidth="2" />
          <path d="M12 26h40" stroke="#2563EB" strokeWidth="2" />
          <circle cx="20" cy="21" r="2" fill="#2563EB" />
          <circle cx="28" cy="21" r="2" fill="#2563EB" />
        </svg>
      ),
      content: (
        <div className="onboarding-form">
          <div className="form-group">
            <label htmlFor="workspaceName">Workspace Name</label>
            <input
              type="text"
              id="workspaceName"
              placeholder="My Company API Security"
              value={formData.workspaceName}
              onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Project Type</label>
            <div className="project-types">
              {['Web API', 'Mobile API', 'Microservices', 'IoT API'].map((type) => (
                <button
                  key={type}
                  className={`project-type-btn ${formData.projectType === type ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, projectType: type })}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'scan',
      title: 'Configure Scanning',
      description: 'Set up how often DevPulse scans your APIs.',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="24" stroke="#2563EB" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="32" cy="32" r="16" stroke="#2563EB" strokeWidth="2" />
          <circle cx="32" cy="32" r="8" stroke="#2563EB" strokeWidth="2" />
          <circle cx="32" cy="32" r="3" fill="#2563EB" />
        </svg>
      ),
      content: (
        <div className="onboarding-form">
          <div className="form-group">
            <label>Scan Frequency</label>
            <div className="frequency-options">
              {[
                { value: 'hourly', label: 'Hourly', desc: 'Best for development' },
                { value: 'daily', label: 'Daily', desc: 'Recommended for most' },
                { value: 'weekly', label: 'Weekly', desc: 'For stable APIs' },
              ].map((option) => (
                <button
                  key={option.value}
                  className={`frequency-btn ${formData.scanFrequency === option.value ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, scanFrequency: option.value })}
                >
                  <span className="frequency-label">{option.label}</span>
                  <span className="frequency-desc">{option.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      title: 'Stay Informed',
      description: 'Choose how you want to receive security alerts.',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path
            d="M32 12v8M24 20h16M20 12a12 12 0 0112 12v16l4 4v4H28v-4l4-4V24a12 12 0 01-12-12z"
            stroke="#2563EB"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      content: (
        <div className="onboarding-form">
          <div className="notification-options">
            <label className="notification-toggle">
              <input
                type="checkbox"
                checked={formData.notifications}
                onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                <strong>Email Notifications</strong>
                <span>Get alerts for critical vulnerabilities</span>
              </span>
            </label>
          </div>
          <div className="notification-channels">
            <span className="channel-badge">Slack</span>
            <span className="channel-badge">PagerDuty</span>
            <span className="channel-badge">Webhooks</span>
            <span className="channel-badge coming-soon">Teams (Coming Soon)</span>
          </div>
        </div>
      ),
    },
    {
      id: 'complete',
      title: "You're All Set!",
      description: 'Start protecting your APIs in minutes.',
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" fill="#DCFCE7" />
          <path
            d="M20 32l8 8 16-16"
            stroke="#16A34A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      content: <CompleteContent />,
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = async () => {
    if (isLastStep) {
      setIsLoading(true);
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsLoading(false);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-container">
        <div className="onboarding-header">
          <div className="onboarding-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" fill="#2563EB" />
              <path d="M10 16h12M16 10v12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>DevPulse</span>
          </div>
          {onSkip && (
            <button className="skip-btn" onClick={onSkip}>
              Skip Setup
            </button>
          )}
        </div>

        <div className="onboarding-progress">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        <div className="onboarding-content">
          <div className="step-indicator">
            Step {currentStep + 1} of {steps.length}
          </div>

          <div className="step-icon">{currentStepData.icon}</div>

          <h2 className="step-title">{currentStepData.title}</h2>
          <p className="step-description">{currentStepData.description}</p>

          <div className="step-content">{currentStepData.content}</div>
        </div>

        <div className="onboarding-footer">
          <div className="step-dots">
            {steps.map((step, index) => (
              <button
                key={step.id}
                className={`step-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                onClick={() => setCurrentStep(index)}
              />
            ))}
          </div>

          <div className="onboarding-actions">
            {!isFirstStep && (
              <button className="btn-secondary" onClick={handleBack} disabled={isLoading}>
                Back
              </button>
            )}
            <button
              className="btn-primary"
              onClick={handleNext}
              disabled={isLoading || (currentStep === 1 && !formData.workspaceName)}
            >
              {isLoading ? (
                <span className="loading-spinner" />
              ) : isLastStep ? (
                'Get Started'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Welcome Content Component
const WelcomeContent: React.FC<{ userEmail?: string }> = ({ userEmail }) => (
  <div className="welcome-content">
    <p className="welcome-message">
      {userEmail ? `Hello ${userEmail.split('@')[0]}!` : 'Hello!'} Ready to secure your APIs?
    </p>
    <div className="feature-list">
      {[
        { icon: '🔍', title: 'Automatic Vulnerability Detection', desc: 'OWASP Top 10, SQL Injection, XSS & more' },
        { icon: '💰', title: 'LLM Cost Intelligence', desc: 'Track and optimize your AI spending' },
        { icon: '🛡️', title: 'Agent Guard', desc: 'Prevent runaway AI agent costs' },
        { icon: '📋', title: 'Compliance Ready', desc: 'GDPR, HIPAA, SOC2, PCI-DSS' },
      ].map((feature) => (
        <div key={feature.title} className="feature-item">
          <span className="feature-icon">{feature.icon}</span>
          <div>
            <strong>{feature.title}</strong>
            <span>{feature.desc}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Complete Content Component
const CompleteContent: React.FC = () => (
  <div className="complete-content">
    <div className="success-features">
      <h3>What happens next?</h3>
      <ul>
        <li>
          <span className="check-icon">✓</span>
          Your workspace is being set up
        </li>
        <li>
          <span className="check-icon">✓</span>
          We'll run your first security scan
        </li>
        <li>
          <span className="check-icon">✓</span>
          You'll receive a summary report
        </li>
      </ul>
    </div>

    <div className="quick-links">
      <h3>Quick Actions</h3>
      <div className="action-cards">
        <button className="action-card">
          <span className="action-icon">📡</span>
          <span>Import API Spec</span>
        </button>
        <button className="action-card">
          <span className="action-icon">🔑</span>
          <span>Connect LLM Provider</span>
        </button>
        <button className="action-card">
          <span className="action-icon">⚙️</span>
          <span>Configure Webhooks</span>
        </button>
      </div>
    </div>
  </div>
);

export default OnboardingWizard;
