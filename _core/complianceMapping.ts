/**
 * PCI DSS v4.0.1 and GDPR Compliance Mapping — DevPulse Patent 4
 * =================================================================
 * Comprehensive compliance mapping from OWASP API Security Top 10 (2023)
 * to PCI DSS v4.0.1 requirements and GDPR articles.
 * 
 * This enables automatic generation of compliance evidence reports
 * from continuous DAST (Dynamic Application Security Testing) output.
 */

export interface ComplianceMapping {
  owaspId: string;
  owaspName: string;
  description: string;
  pciRequirements: PCIDSSRequirement[];
  gdprArticles: GDPRArticle[];
}

export interface PCIDSSRequirement {
  id: string;
  title: string;
  description: string;
  statusIfFound: 'PASS' | 'FAIL' | 'WARN';
  evidence: string;
  remediation: string;
}

export interface GDPRArticle {
  article: string;
  title: string;
  requirement: string;
  recommendation: string;
}

// ─── OWASP → PCI DSS v4.0.1 Mapping ──────────────────────────────────────────

export const OWASP_PCI_DSS_MAPPING: Record<string, ComplianceMapping> = {
  'API1:2023': {
    owaspId: 'API1:2023',
    owaspName: 'Broken Object Level Authorization',
    description: 'Attackers exploit endpoints by manipulating object IDs to access resources belonging to other users.',
    pciRequirements: [
      {
        id: '6.2.4',
        title: 'Protect all applications and systems against known attacks',
        description: 'BOLA vulnerabilities allow unauthorized access to other users\' data.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse DAST scan detected potential IDOR vulnerability.',
        remediation: 'Implement object-level authorization checks. Use indirect references. Validate user ownership of requested objects.',
      },
      {
        id: '6.3.1',
        title: 'Maintain inventory of bespoke and custom software',
        description: 'Unauthorized access due to missing authorization checks on object endpoints.',
        statusIfFound: 'FAIL',
        evidence: 'Endpoint accessible without proper object ownership verification.',
        remediation: 'Document all API endpoints with their authorization requirements. Implement automated authorization testing.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 5(1)(f)',
        title: 'Integrity and Confidentiality',
        requirement: 'Personal data shall be processed in a manner that ensures appropriate security, including protection against unauthorized access.',
        recommendation: 'Implement object-level authorization for all endpoints returning personal data. Verify user ownership before data disclosure.',
      },
      {
        article: 'Article 32',
        title: 'Security of Processing',
        requirement: 'Implement appropriate technical measures to secure personal data including pseudonymsation and encryption.',
        recommendation: 'Add authorization checks at the object level. Log all unauthorized access attempts.',
      },
    ],
  },

  'API2:2023': {
    owaspId: 'API2:2023',
    owaspName: 'Broken Authentication',
    description: 'Authentication mechanisms are implemented incorrectly, allowing attackers to compromise tokens or assume user identities.',
    pciRequirements: [
      {
        id: '8.2.1',
        title: 'Strong cryptography renders authenticated data unreadable',
        description: 'Weak or missing authentication allows attacker impersonation.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected missing or weak authentication mechanism.',
        remediation: 'Implement strong authentication: MFA, JWT with short expiry, OAuth2. Remove default credentials.',
      },
      {
        id: '8.3.1',
        title: 'Implement MFA for all access into CDE',
        description: 'All access to cardholder data environment requires strong authentication.',
        statusIfFound: 'FAIL',
        evidence: 'API lacks multi-factor authentication.',
        remediation: 'Implement MFA for all API access. Use industry standards like OAuth2 with PKCE.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 5(1)(f)',
        title: 'Integrity and Confidentiality',
        requirement: 'Personal data shall be processed in a manner that ensures appropriate security.',
        recommendation: 'Implement strong authentication. Use industry standards: OAuth2, OpenID Connect, or SAML.',
      },
      {
        article: 'Article 32',
        title: 'Security of Processing',
        requirement: 'Measures include authentication and access control.',
        recommendation: 'Enforce strong passwords, implement MFA, use secure token management.',
      },
    ],
  },

  'API3:2023': {
    owaspId: 'API3:2023',
    owaspName: 'Broken Object Property Level Authorization',
    description: 'Attackers exploit endpoints by viewing or modifying object properties they should not have access to. Includes Mass Assignment and Excessive Data Exposure.',
    pciRequirements: [
      {
        id: '6.2.4',
        title: 'Protect all applications and systems against known attacks',
        description: 'Mass assignment allows attackers to modify protected fields.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected excessive data exposure or mass assignment vulnerability.',
        remediation: 'Use allowlists for updatable fields. Implement property-level authorization. Filter sensitive fields from responses.',
      },
      {
        id: '3.3',
        title: 'Mask PAN when displayed',
        description: 'Full PAN visible in API responses violates data minimization.',
        statusIfFound: 'FAIL',
        evidence: 'API response contains unmasked or excessive cardholder data.',
        remediation: 'Implement field-level masking. Return only last 4 digits. Use DTOs for response filtering.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 5(1)(c)',
        title: 'Data Minimisation',
        requirement: 'Personal data shall be adequate, relevant, and limited to what is necessary.',
        recommendation: 'Implement field-level filtering in API responses. Return only necessary data fields.',
      },
      {
        article: 'Article 25',
        title: 'Data Protection by Design',
        requirement: 'Implement data protection principles by design and by default.',
        recommendation: 'Use DTOs, field masking, and response filtering. Never return full objects without filtering.',
      },
    ],
  },

  'API4:2023': {
    owaspId: 'API4:2023',
    owaspName: 'Unrestricted Resource Consumption',
    description: 'API requests consume resources without limits, enabling denial of service attacks.',
    pciRequirements: [
      {
        id: '6.4.1',
        title: 'Protect public-facing web applications',
        description: 'Unrestricted API consumption enables DoS attacks.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected missing rate limiting on API endpoints.',
        remediation: 'Implement rate limiting, throttling, and resource quotas. Set maximum request sizes.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 32',
        title: 'Security of Processing',
        requirement: 'Ensure resilience against denial of service attacks.',
        recommendation: 'Implement rate limiting, request throttling, and resource quotas. Use CDN and WAF.',
      },
    ],
  },

  'API5:2023': {
    owaspId: 'API5:2023',
    owaspName: 'Broken Function Level Authorization',
    description: 'Attackers exploit administrative API endpoints by sending legitimate API calls to functions they should not have access to.',
    pciRequirements: [
      {
        id: '6.2.4',
        title: 'Protect all applications and systems',
        description: 'Unauthorized admin function access.',
        statusIfFound: 'FAIL',
        evidence: 'Admin endpoints accessible without proper authorization.',
        remediation: 'Implement function-level authorization. Use RBAC. Verify user role before executing privileged operations.',
      },
      {
        id: '7.1.1',
        title: 'Principle of least privilege',
        description: 'Users should only have access to functions required for their role.',
        statusIfFound: 'FAIL',
        evidence: 'API allows access to administrative functions without role verification.',
        remediation: 'Implement role-based access control. Verify permissions on every privileged operation.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 5(1)(f)',
        title: 'Integrity and Confidentiality',
        requirement: 'Appropriate access controls for processing personal data.',
        recommendation: 'Implement RBAC. Verify function-level authorization on every admin operation.',
      },
    ],
  },

  'API6:2023': {
    owaspId: 'API6:2023',
    owaspName: 'Unrestricted Access to Sensitive Business Flows',
    description: 'Attackers exploit business logic flows by automating legitimate API calls to cause harm (e.g., ticket scalping, inventory hoarding).',
    pciRequirements: [
      {
        id: '6.4.2',
        title: 'Prevent automation of attacks',
        description: 'Business logic exploitation through API automation.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected unprotected business flow vulnerable to automation.',
        remediation: 'Implement anti-automation controls: CAPTCHA, rate limiting, unique request signatures.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 32',
        title: 'Security of Processing',
        requirement: 'Protect against automated threats to business processes.',
        recommendation: 'Implement anti-automation measures. Use behavioral analysis to detect unusual patterns.',
      },
    ],
  },

  'API7:2023': {
    owaspId: 'API7:2023',
    owaspName: 'Server Side Request Forgery',
    description: 'The API fetches remote resources without validating the user-supplied URI, enabling attackers to access internal resources.',
    pciRequirements: [
      {
        id: '6.2.4',
        title: 'Protect against SSRF attacks',
        description: 'SSRF allows attackers to access internal systems.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected potential SSRF vulnerability.',
        remediation: 'Validate and sanitize all user-supplied URLs. Use allowlists for permitted destinations. Disable HTTP redirects.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 32',
        title: 'Security of Processing',
        requirement: 'Protect against unauthorized internal access.',
        recommendation: 'Validate URLs against allowlists. Never trust user-supplied URLs for internal requests.',
      },
    ],
  },

  'API8:2023': {
    owaspId: 'API8:2023',
    owaspName: 'Security Misconfiguration',
    description: 'Missing security headers, improper CORS configuration, verbose error messages, default credentials, or unnecessary features enabled.',
    pciRequirements: [
      {
        id: '2.2.1',
        title: 'Configuration standards are developed and implemented',
        description: 'Missing security headers indicate non-compliance with configuration standards.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected missing security headers: HSTS, CSP, X-Frame-Options.',
        remediation: 'Implement all required security headers. Disable debug modes. Remove default credentials.',
      },
      {
        id: '6.2.4',
        title: 'Protect all applications and systems',
        description: 'CORS misconfiguration allows unauthorized cross-origin access.',
        statusIfFound: 'FAIL',
        evidence: 'CORS policy allows all origins (*).',
        remediation: 'Restrict CORS to specific trusted origins. Never use wildcard with credentials.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 32',
        title: 'Security of Processing',
        requirement: 'Technical measures including security configuration.',
        recommendation: 'Implement security headers. Disable verbose errors. Use secure defaults.',
      },
    ],
  },

  'API9:2023': {
    owaspId: 'API9:2023',
    owaspName: 'Improper Inventory Management',
    description: 'Lack of proper API inventory management leads to shadow APIs, deprecated endpoints, and exposed documentation.',
    pciRequirements: [
      {
        id: '6.3.2',
        title: 'Maintain inventory of API endpoints',
        description: 'Undocumented APIs may not have proper security controls.',
        statusIfFound: 'WARN',
        evidence: 'DevPulse detected undocumented or shadow API endpoints.',
        remediation: 'Maintain comprehensive API inventory. Document all endpoints. Deprecate unused endpoints.',
      },
      {
        id: '12.3.1',
        title: 'Targeted risk assessments for data flows',
        description: 'Undocumented APIs may expose cardholder data.',
        statusIfFound: 'WARN',
        evidence: 'API endpoint not documented in data flow inventory.',
        remediation: 'Document all API data flows. Include them in data flow diagrams and risk assessments.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 30',
        title: 'Records of Processing Activities',
        requirement: 'Maintain records of processing activities including purposes, categories, recipients, transfers.',
        recommendation: 'Maintain comprehensive API inventory mapping each endpoint to personal data processed.',
      },
    ],
  },

  'API10:2023': {
    owaspId: 'API10:2023',
    owaspName: 'Unsafe Consumption of APIs',
    description: 'Developers trust data from third-party APIs more than user input, leading to injection, SSRF, or data integrity issues.',
    pciRequirements: [
      {
        id: '6.2.4',
        title: 'Validate all external APIs and data sources',
        description: 'Unvalidated third-party API responses can introduce vulnerabilities.',
        statusIfFound: 'FAIL',
        evidence: 'DevPulse detected potential injection from third-party API response.',
        remediation: 'Validate all data from third-party APIs. Treat as user input. Implement output encoding.',
      },
    ],
    gdprArticles: [
      {
        article: 'Article 28',
        title: 'Processor Obligations',
        requirement: 'Processors must provide sufficient guarantees of security measures.',
        recommendation: 'Validate all data from third-party APIs. Never trust external data without validation.',
      },
    ],
  },
};

// ─── GDPR Assessment Criteria ────────────────────────────────────────────────

export const GDPR_ASSESSMENT_CRITERIA = [
  {
    article: 'Article 5(1)(a)',
    title: 'Lawfulness, Fairness, Transparency',
    description: 'Data processing must be lawful, fair, and transparent to the data subject.',
    checkKeywords: ['transparency', 'privacy notice', 'consent', 'lawful basis'],
    remediation: 'Ensure API endpoints provide clear privacy notices and obtain consent where required.',
  },
  {
    article: 'Article 5(1)(b)',
    title: 'Purpose Limitation',
    description: 'Data collected for specified purposes only.',
    checkKeywords: ['purpose', 'specified purpose'],
    remediation: 'Document the purpose of each API endpoint\'s data collection in privacy impact assessments.',
  },
  {
    article: 'Article 5(1)(c)',
    title: 'Data Minimisation',
    description: 'Only collect data adequate, relevant, and limited to what is necessary.',
    checkKeywords: ['minimisation', 'adequate', 'relevant'],
    remediation: 'Implement field-level filtering. Return only necessary data in API responses.',
  },
  {
    article: 'Article 5(1)(d)',
    title: 'Accuracy',
    description: 'Personal data shall be accurate and kept up to date.',
    checkKeywords: ['accuracy', 'correction', 'erasure'],
    remediation: 'Implement correction and erasure endpoints. Allow data subjects to update their data.',
  },
  {
    article: 'Article 5(1)(e)',
    title: 'Storage Limitation',
    description: 'Store data only as long as necessary for purposes.',
    checkKeywords: ['retention', 'deletion', 'storage'],
    remediation: 'Implement data retention policies. Auto-delete data after retention period.',
  },
  {
    article: 'Article 5(1)(f)',
    title: 'Integrity and Confidentiality',
    description: 'Process data securely with appropriate security measures.',
    checkKeywords: ['security', 'confidentiality', 'integrity'],
    remediation: 'Implement OWASP recommendations for API security. Use encryption, access controls.',
  },
  {
    article: 'Article 6',
    title: 'Lawfulness of Processing',
    description: 'Processing must have a valid legal basis.',
    checkKeywords: ['consent', 'contract', 'legitimate interest', 'legal obligation'],
    remediation: 'Document legal basis for each data processing activity in API endpoints.',
  },
  {
    article: 'Article 17',
    title: 'Right to Erasure',
    description: 'Data subjects can request deletion of their personal data.',
    checkKeywords: ['erasure', 'deletion', 'right to be forgotten'],
    remediation: 'Implement DELETE endpoints and data subject identity verification.',
  },
  {
    article: 'Article 20',
    title: 'Right to Data Portability',
    description: 'Data subjects can receive their data in structured, machine-readable format.',
    checkKeywords: ['portability', 'machine-readable', 'export'],
    remediation: 'Implement data export endpoints in standard formats (JSON, XML, CSV).',
  },
  {
    article: 'Article 25',
    title: 'Data Protection by Design',
    description: 'Implement data protection principles by design and default.',
    checkKeywords: ['privacy by design', 'default settings'],
    remediation: 'Build privacy controls into API design from the start. Use privacy-preserving defaults.',
  },
  {
    article: 'Article 30',
    title: 'Records of Processing Activities',
    description: 'Maintain records of all processing activities.',
    checkKeywords: ['inventory', 'documentation', 'records'],
    remediation: 'Maintain comprehensive API inventory documenting each endpoint\'s data processing activities.',
  },
  {
    article: 'Article 32',
    title: 'Security of Processing',
    description: 'Implement appropriate technical measures to secure personal data.',
    checkKeywords: ['encryption', 'pseudonymisation', 'security measures'],
    remediation: 'Encrypt data at rest and in transit. Implement OWASP API security recommendations.',
  },
  {
    article: 'Article 33',
    title: 'Breach Notification',
    description: 'Notify supervisory authority of data breaches within 72 hours.',
    checkKeywords: ['breach', 'notification', 'incident'],
    remediation: 'Implement breach detection and notification procedures. Define escalation paths.',
  },
  {
    article: 'Article 35',
    title: 'Data Protection Impact Assessment',
    description: 'Conduct DPIA for high-risk processing activities.',
    checkKeywords: ['impact assessment', 'high risk', 'dpiA'],
    remediation: 'Conduct DPIAs for APIs processing sensitive data or large volumes.',
  },
];

// ─── Utility Functions ───────────────────────────────────────────────────────

export function getOwaspCategories(): string[] {
  return Object.keys(OWASP_PCI_DSS_MAPPING);
}

export function getOwaspMapping(owaspId: string): ComplianceMapping | undefined {
  return OWASP_PCI_DSS_MAPPING[owaspId];
}

export function getAllPCIRequirements(): PCIDSSRequirement[] {
  const seen = new Set<string>();
  const result: PCIDSSRequirement[] = [];

  for (const mapping of Object.values(OWASP_PCI_DSS_MAPPING)) {
    for (const req of mapping.pciRequirements) {
      if (!seen.has(req.id)) {
        seen.add(req.id);
        result.push({ ...req, description: `${req.description} (Source: ${mapping.owaspId})` });
      }
    }
  }

  return result;
}

export function getAllGDPRArticles(): GDPRArticle[] {
  const seen = new Set<string>();
  const result: GDPRArticle[] = [];

  for (const mapping of Object.values(OWASP_PCI_DSS_MAPPING)) {
    for (const article of mapping.gdprArticles) {
      if (!seen.has(article.article)) {
        seen.add(article.article);
        result.push({ ...article, recommendation: `${article.recommendation} (Source: ${mapping.owaspId})` });
      }
    }
  }

  return result;
}

export function generateComplianceEvidence(
  owaspId: string,
  findings: { severity: string; description: string }[]
): {
  pciStatus: 'PASS' | 'FAIL' | 'WARN';
  evidence: string;
  affectedRequirements: string[];
} {
  const mapping = OWASP_PCI_DSS_MAPPING[owaspId];
  if (!mapping) {
    return { pciStatus: 'PASS', evidence: 'No findings for this category.', affectedRequirements: [] };
  }

  const criticalOrHigh = findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  const pciStatus: 'PASS' | 'FAIL' | 'WARN' = criticalOrHigh ? 'FAIL' : findings.length > 0 ? 'WARN' : 'PASS';

  return {
    pciStatus,
    evidence: `DevPulse detected ${findings.length} ${owaspId} issues. ${criticalOrHigh ? 'Critical or high severity findings require immediate remediation.' : 'Review findings and remediate as needed.'}`,
    affectedRequirements: mapping.pciRequirements.map(r => r.id),
  };
}
