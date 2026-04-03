// DevPulse Demo Data - Realistic sample data for development

// Demo statistics
export const DEMO_STATS = {
  apisScanned: 247,
  criticalVulns: 3,
  highVulns: 8,
  mediumVulns: 12,
  lowVulns: 5,
  llmSpendInr: 18420,
  llmSpendUsd: 220.14,
  agentsProtected: 12,
  activeAgents: 4,
  incidentsBlocked: 2,
  securityScore: 72,
  riskTier: 'moderate',
};

// Generate realistic cost trend data
function generateCostTrend() {
  const data = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Base cost with some variation
    const baseCost = 5 + Math.random() * 10;
    // Weekend dip
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const weekendFactor = isWeekend ? 0.6 : 1;
    // Trend upward
    const trendFactor = 1 + (29 - i) * 0.02;
    // Random spike
    const spike = Math.random() > 0.9 ? Math.random() * 15 : 0;
    
    const totalCost = Math.round((baseCost * weekendFactor * trendFactor + spike) * 100) / 100;
    const thinkingCost = Math.round(totalCost * (0.18 + Math.random() * 0.25) * 100) / 100;

    data.push({
      date: date.toISOString(),
      cost: totalCost,
      thinkingCost,
    });
  }
  
  return data;
}

// Generate vulnerability data
function generateVulnerabilities() {
  return [
    {
      id: 'VULN-001',
      title: 'Broken Object Level Authorization (BOLA)',
      severity: 'critical',
      category: 'API1',
      endpoint: '/api/v1/users/{id}',
      method: 'GET',
      status: 'open',
      cvss: 9.1,
      cwe: 'CWE-639',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-002',
      title: 'Broken Authentication',
      severity: 'critical',
      category: 'API2',
      endpoint: '/api/v1/auth/token',
      method: 'POST',
      status: 'open',
      cvss: 8.2,
      cwe: 'CWE-287',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-003',
      title: 'Excessive Data Exposure',
      severity: 'high',
      category: 'API3',
      endpoint: '/api/v1/users/search',
      method: 'GET',
      status: 'open',
      cvss: 7.5,
      cwe: 'CWE-200',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-004',
      title: 'SQL Injection in Search',
      severity: 'high',
      category: 'API1',
      endpoint: '/api/v1/search',
      method: 'GET',
      status: 'in_progress',
      cvss: 9.8,
      cwe: 'CWE-89',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-005',
      title: 'Mass Assignment in User Update',
      severity: 'high',
      category: 'API3',
      endpoint: '/api/v1/users/{id}',
      method: 'PATCH',
      status: 'open',
      cvss: 7.2,
      cwe: 'CWE-915',
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-006',
      title: 'Lack of Resources & Rate Limiting',
      severity: 'medium',
      category: 'API4',
      endpoint: '/api/v1/bulk-process',
      method: 'POST',
      status: 'open',
      cvss: 5.3,
      cwe: 'CWE-770',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-007',
      title: 'Broken Function Level Authorization',
      severity: 'medium',
      category: 'API5',
      endpoint: '/api/v1/admin/users',
      method: 'DELETE',
      status: 'open',
      cvss: 6.5,
      cwe: 'CWE-285',
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'VULN-008',
      title: 'Security Misconfiguration - CORS',
      severity: 'medium',
      category: 'API8',
      endpoint: '/api/v1/*',
      method: '*',
      status: 'resolved',
      cvss: 5.3,
      cwe: 'CWE-942',
      createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// Generate activity feed data
function generateActivity() {
  return [
    {
      id: 'ACT-001',
      type: 'vulnerability_found',
      title: 'Critical BOLA vulnerability detected',
      description: 'Endpoint /api/v1/users/{id} allows unauthorized access',
      severity: 'critical',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ACT-002',
      type: 'scan_completed',
      title: 'Security scan completed',
      description: '247 endpoints scanned in 45 seconds',
      severity: 'info',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ACT-003',
      type: 'cost_spike',
      title: 'LLM cost spike detected',
      description: 'GPT-4o usage 45% above daily average',
      severity: 'high',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ACT-004',
      type: 'postman_import',
      title: 'Postman collection imported',
      description: 'E-commerce API collection (89 endpoints)',
      severity: 'info',
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ACT-005',
      type: 'agent_killed',
      title: 'Rogue agent terminated',
      description: 'agent-xyz-789 exceeded budget limit ($50)',
      severity: 'critical',
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ACT-006',
      type: 'vulnerability_found',
      title: 'SQL injection in search endpoint',
      description: 'Potential SQLi via q parameter',
      severity: 'high',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ACT-007',
      type: 'scan_completed',
      title: 'Weekly security scan completed',
      description: 'All 247 endpoints scanned, 3 new vulnerabilities',
      severity: 'info',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// Generate agent data
function generateAgents() {
  return [
    {
      agentId: 'agent-customer-support-01',
      name: 'Customer Support Bot',
      totalCalls: 15847,
      totalCost: 47.32,
      status: 'active',
      lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      agentId: 'agent-code-review-02',
      name: 'Code Review Assistant',
      totalCalls: 8234,
      totalCost: 156.78,
      status: 'active',
      lastActivity: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      agentId: 'agent-data-analysis-03',
      name: 'Data Analysis Agent',
      totalCalls: 4219,
      totalCost: 89.45,
      status: 'active',
      lastActivity: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      agentId: 'agent-doc-generator-04',
      name: 'Documentation Generator',
      totalCalls: 2156,
      totalCost: 23.67,
      status: 'paused',
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      agentId: 'agent-test-runner-05',
      name: 'Test Automation Agent',
      totalCalls: 987,
      totalCost: 34.12,
      status: 'active',
      lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ];
}

// Generate shadow API data
function generateShadowApis() {
  return [
    {
      id: 'SHADOW-001',
      endpoint: '/api/v2/internal/metrics',
      method: 'GET',
      discoveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      riskTier: 'HIGH',
      riskLevel: 'high',
      riskScore: 82,
      callCount: 1247,
      traffic: 1247,
      totalCost: 28.74,
      avgLatencyMs: 243,
      thinkingTokensUsed: 12400,
      riskFactors: ['no_auth', 'internal_endpoint', 'high_traffic'],
      isWhitelisted: false,
      authenticated: false,
    },
    {
      id: 'SHADOW-002',
      endpoint: '/debug/health-check',
      method: 'GET',
      discoveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      riskTier: 'CRITICAL',
      riskLevel: 'critical',
      riskScore: 95,
      callCount: 8934,
      traffic: 8934,
      totalCost: 72.11,
      avgLatencyMs: 111,
      thinkingTokensUsed: 0,
      riskFactors: ['debug_endpoint', 'public_access', 'excessive_calls'],
      isWhitelisted: false,
      authenticated: false,
    },
    {
      id: 'SHADOW-003',
      endpoint: '/api/legacy/users/export',
      method: 'POST',
      discoveredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      riskTier: 'MEDIUM',
      riskLevel: 'medium',
      riskScore: 58,
      callCount: 234,
      traffic: 234,
      totalCost: 6.92,
      avgLatencyMs: 566,
      thinkingTokensUsed: 5200,
      riskFactors: ['legacy_route', 'bulk_export'],
      isWhitelisted: true,
      authenticated: true,
    },
  ];
}

// LLM Cost by model
export const DEMO_COST_BY_MODEL = {
  gpt4: { cost: 287.45, percentage: 52, calls: 4523 },
  claude: { cost: 134.67, percentage: 24, calls: 2156 },
  gemini: { cost: 68.34, percentage: 12, calls: 3421 },
  others: { cost: 12.45, percentage: 2, calls: 567 },
};

// Export generated data
export const DEMO_COST_TREND = generateCostTrend();
export const DEMO_VULNERABILITIES = generateVulnerabilities();
export const DEMO_ACTIVITY = generateActivity();
export const DEMO_AGENTS = generateAgents();
export const DEMO_SHADOW_APIS = generateShadowApis();

// Thinking token analysis
export const DEMO_THINKING_TOKENS = [
  {
    id: 'TT-001',
    provider: 'openai',
    model: 'o1-preview',
    requestTokens: 1200,
    thinkingTokens: 8500,
    completionTokens: 450,
    estimatedCost: 0.23,
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'TT-002',
    provider: 'anthropic',
    model: 'claude-3-opus',
    thinkingTokens: 6200,
    completionTokens: 380,
    estimatedCost: 0.18,
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'TT-003',
    provider: 'openai',
    model: 'o1-mini',
    requestTokens: 800,
    thinkingTokens: 3200,
    completionTokens: 280,
    estimatedCost: 0.08,
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

// Compliance status
export const DEMO_COMPLIANCE = {
  pciDss: {
    score: 78,
    controlsPassed: 45,
    controlsFailed: 8,
    controlsPending: 12,
  },
  gdpr: {
    score: 82,
    requirementsMet: 28,
    requirementsPartial: 5,
    requirementsMissing: 2,
  },
  soc2: {
    score: 75,
    criteriaMet: 32,
    criteriaPartial: 8,
    criteriaNotMet: 4,
  },
};

// Backward-compatible exports expected by multiple pages
export const DEMO_COST_BY_FEATURE = [
  { featureName: 'Code Review', costUsd: 96.42, calls: 4120 },
  { featureName: 'Customer Support', costUsd: 68.11, calls: 5290 },
  { featureName: 'Data Analysis', costUsd: 34.75, calls: 1630 },
  { featureName: 'Agent Guarding', costUsd: 20.86, calls: 980 },
];

export const DEMO_COST_BY_PROVIDER = [
  { provider: 'OpenAI', costUsd: 118.24, percentage: 54, models: ['gpt-4o', 'o1-mini'] },
  { provider: 'Anthropic', costUsd: 73.55, percentage: 33, models: ['claude-3.5-sonnet'] },
  { provider: 'Google', costUsd: 28.35, percentage: 13, models: ['gemini-1.5-pro'] },
];

export const DEMO_THINKING_SUMMARY = {
  totalThinkingTokens: DEMO_THINKING_TOKENS.reduce((s, t) => s + (t.thinkingTokens || 0), 0),
  percentOfTotalTokens: 21,
  estimatedCostUsd: Math.round(DEMO_THINKING_TOKENS.reduce((s, t) => s + (t.estimatedCost || 0), 0) * 100) / 100,
  eventCount: DEMO_THINKING_TOKENS.length,
  averagePerCall: Math.round(DEMO_THINKING_TOKENS.reduce((s, t) => s + (t.thinkingTokens || 0), 0) / Math.max(1, DEMO_THINKING_TOKENS.length)),
  topFeature: {
    feature: 'Reasoning / Long-context requests',
    tokens: 8500,
    cost: 0.23,
    percent: 37,
  },
  modelsUsing: ['o1-preview', 'claude-3-opus', 'o1-mini'],
};

export const DEMO_THINKING_BY_MODEL = [
  { model: 'o1-preview', totalThinkingTokens: 8500, averageThinkingTokensPerCall: 8500, eventCount: 1, estimatedCostUsd: 0.23, percentOfTotalCost: 47 },
  { model: 'claude-3-opus', totalThinkingTokens: 6200, averageThinkingTokensPerCall: 6200, eventCount: 1, estimatedCostUsd: 0.18, percentOfTotalCost: 37 },
  { model: 'o1-mini', totalThinkingTokens: 3200, averageThinkingTokensPerCall: 3200, eventCount: 1, estimatedCostUsd: 0.08, percentOfTotalCost: 16 },
];

export const DEMO_AGENT_STATS = {
  totalAgents: DEMO_AGENTS.length,
  activeAgents: DEMO_AGENTS.filter(a => a.status === 'active').length,
  totalCost: Math.round(DEMO_AGENTS.reduce((s, a) => s + a.totalCost, 0) * 100) / 100,
  budgetLimit: 250,
  riskScore: 64,
  riskTier: 'ELEVATED',
  interventions: 3,
};

export const DEMO_INTERVENTIONS = [
  { agentId: 'agent-code-review-02', reason: 'Budget spike detected', costUsd: 18.32, timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { agentId: 'agent-data-analysis-03', reason: 'Runaway reasoning loop', costUsd: 11.47, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { agentId: 'agent-doc-generator-04', reason: 'Exceeded daily threshold', costUsd: 7.96, timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
];

export const DEMO_API_KEYS = [
  { id: 1, service: 'OpenAI', maskedKey: 'sk-...7f2a' },
  { id: 2, service: 'Anthropic', maskedKey: 'sk-ant-...1c9b' },
  { id: 3, service: 'Google AI', maskedKey: 'AIza...3de4' },
];

export const DEMO_SCANS = [
  { id: 1, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), scannedEndpoints: 247, vulnerabilitiesFound: 5, status: 'completed' },
  { id: 2, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), scannedEndpoints: 239, vulnerabilitiesFound: 8, status: 'completed' },
  { id: 3, createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), scannedEndpoints: 226, vulnerabilitiesFound: 6, status: 'completed' },
];
