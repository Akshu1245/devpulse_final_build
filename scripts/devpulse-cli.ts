#!/usr/bin/env node

/**
 * DevPulse CLI Tool
 * 
 * Command-line interface for DevPulse API Security & LLM Cost Intelligence platform.
 * Supports CI/CD integration, security scanning, and real-time monitoring.
 * 
 * @example
 * npx devpulse-cli scan --workspace-id 123 --api-key $DEVPULSE_API_KEY
 * npx devpulse-cli report --format json
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import https from 'https';
import http from 'http';

const program = new Command();

// Configuration
interface Config {
  apiUrl: string;
  apiKey: string;
  workspaceId: string;
  timeout: number;
  verbose: boolean;
}

let config: Config = {
  apiUrl: process.env.DEVPULSE_API_URL || 'https://api.devpulse.in',
  apiKey: process.env.DEVPULSE_API_KEY || '',
  workspaceId: process.env.DEVPULSE_WORKSPACE_ID || '',
  timeout: 300000, // 5 minutes
  verbose: false,
};

/**
 * HTTP request helper
 */
async function apiRequest(
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const url = new URL(`${config.apiUrl}${path}`);
  
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'User-Agent': 'DevPulse-CLI/1.0.0',
      },
      timeout: config.timeout,
    };

    const protocol = url.protocol === 'https:' ? https : http;
    
    if (config.verbose) {
      console.log(`[DevPulse CLI] ${method} ${url.href}`);
    }

    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch {
          reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

/**
 * Load config from file
 */
function loadConfig(): void {
  const configPaths = [
    '.devpulse/config.json',
    '.devpulse.json',
    'devpulse.config.json',
    process.env.HOME + '/.devpulse/config.json',
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        const fileConfig = JSON.parse(content);
        config = { ...config, ...fileConfig };
        console.log(`[DevPulse CLI] Loaded config from ${path}`);
        break;
      } catch (e) {
        console.warn(`[DevPulse CLI] Failed to load config from ${path}:`, e);
      }
    }
  }
}

/**
 * Check API connectivity
 */
async function checkApiHealth(): Promise<boolean> {
  try {
    await apiRequest('GET', '/health');
    return true;
  } catch {
    return false;
  }
}

// Main command setup
program
  .name('devpulse-cli')
  .description('DevPulse CLI - API Security & LLM Cost Intelligence')
  .version('1.0.0')
  .option('-v, --verbose', 'Verbose output')
  .option('-c, --config <path>', 'Config file path')
  .option('--api-url <url>', 'API URL')
  .option('--api-key <key>', 'API Key')
  .option('--workspace-id <id>', 'Workspace ID')
  .hook('preAction', () => {
    loadConfig();
  });

/**
 * Scan command - Run a security scan
 */
const scanCmd = program.command('scan')
  .description('Run a security scan')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .option('--project-id <id>', 'Project ID (optional)')
  .option('--commit <sha>', 'Git commit SHA')
  .option('--branch <name>', 'Git branch name')
  .option('--source <source>', 'Scan source (github_actions, gitlab_ci, jenkins, local)', 'local')
  .option('--output <file>', 'Output file path', 'devpulse-results.json')
  .option('--format <format>', 'Output format (json, sarif, html, markdown)', 'json')
  .option('--timeout <seconds>', 'Scan timeout in seconds', '300')
  .option('--auto-scan', 'Enable auto-scanning', true)
  .option('--postman <file>', 'Postman collection file to import')
  .option('--openapi <file>', 'OpenAPI spec file to import')
  .action(async (options) => {
    console.log('🔍 DevPulse: Starting security scan...\n');

    // Check API health
    const healthy = await checkApiHealth();
    if (!healthy) {
      console.error('❌ DevPulse API is unreachable. Please check your network and API URL.');
      process.exit(1);
    }

    let scanId: number;

    // Import Postman collection if provided
    if (options.postman) {
      console.log(`📥 Importing Postman collection: ${options.postman}`);
      try {
        const postmanContent = readFileSync(options.postman, 'utf-8');
        const result = await apiRequest('POST', '/trpc/postman.importCollection', {
          workspaceId: parseInt(options.workspaceId),
          collectionJson: postmanContent,
          autoScan: options.autoScan,
        }) as any;
        
        scanId = result?.result?.data?.scanId;
        console.log(`✅ Imported collection: ${result?.result?.data?.totalEndpoints} endpoints`);
        console.log(`   Scan ID: ${scanId}`);
      } catch (e) {
        console.error('❌ Failed to import Postman collection:', e);
        process.exit(1);
      }
    } else {
      // Start new scan
      try {
        const startResult = await apiRequest('POST', '/trpc/scan.startCiScan', {
          workspaceId: parseInt(options.workspaceId),
          projectId: options.projectId ? parseInt(options.projectId) : undefined,
          commitSha: options.commit,
          branch: options.branch,
          source: options.source,
        }) as any;
        
        scanId = startResult?.result?.data?.scanId;
        
        if (!scanId) {
          throw new Error('Failed to get scan ID');
        }
        
        console.log(`✅ Scan started: ID ${scanId}`);
      } catch (e) {
        console.error('❌ Failed to start scan:', e);
        process.exit(1);
      }
    }

    // Poll for scan completion
    console.log('\n⏳ Waiting for scan to complete...\n');
    const startTime = Date.now();
    const timeout = parseInt(options.timeout) * 1000;
    let status = 'pending';
    let progress = 0;

    while (status === 'pending' || status === 'running') {
      if (Date.now() - startTime > timeout) {
        console.warn('⚠️  Scan timed out. Results may be incomplete.');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const pollResult = await apiRequest('GET', `/trpc/scan.getScanStatus?input=${encodeURIComponent(JSON.stringify({ scanId }))}`) as any;
        status = pollResult?.result?.data?.status || 'unknown';
        progress = pollResult?.result?.data?.progress || progress;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`   [${elapsed}s] Progress: ${progress}% (${status})`);
      } catch (e) {
        console.warn(`   ⚠️  Failed to poll status: ${e}`);
      }
    }

    // Get final results
    console.log('\n📊 Fetching results...');
    try {
      const results = await apiRequest('GET', `/trpc/scan.getScanResults?input=${encodeURIComponent(JSON.stringify({ scanId }))}`) as any;
      
      const formattedResults = {
        scanId,
        status: results?.result?.data?.scan?.status || 'unknown',
        riskScore: results?.result?.data?.scan?.riskScore || 0,
        riskTier: results?.result?.data?.scan?.riskTier || 'unknown',
        critical: results?.result?.data?.vulnerabilities?.filter((v: any) => v.severity === 'critical').length || 0,
        high: results?.result?.data?.vulnerabilities?.filter((v: any) => v.severity === 'high').length || 0,
        medium: results?.result?.data?.vulnerabilities?.filter((v: any) => v.severity === 'medium').length || 0,
        low: results?.result?.data?.vulnerabilities?.filter((v: any) => v.severity === 'low').length || 0,
        totalVulnerabilities: results?.result?.data?.vulnerabilities?.length || 0,
        topFindings: (results?.result?.data?.vulnerabilities || []).slice(0, 10).map((v: any) => ({
          severity: v.severity,
          title: v.title,
          endpoint: v.endpoint,
          method: v.method,
        })),
        costSummary: results?.result?.data?.scan?.costSummary,
        reportUrl: `https://dashboard.devpulse.in/scan/${scanId}`,
        timestamp: new Date().toISOString(),
      };

      // Save results
      const fs = require('fs');
      fs.writeFileSync(options.output, JSON.stringify(formattedResults, null, 2));
      console.log(`✅ Results saved to: ${options.output}`);

      // Print summary
      console.log('\n' + '='.repeat(50));
      console.log('📋 SCAN SUMMARY');
      console.log('='.repeat(50));
      console.log(`Risk Score: ${formattedResults.riskScore}/100 (${formattedResults.riskTier})`);
      console.log(`\nVulnerabilities:`);
      console.log(`  🔴 Critical: ${formattedResults.critical}`);
      console.log(`  🟠 High:     ${formattedResults.high}`);
      console.log(`  🟡 Medium:   ${formattedResults.medium}`);
      console.log(`  🟢 Low:      ${formattedResults.low}`);

      if (formattedResults.costSummary) {
        console.log(`\n💰 LLM Cost:`);
        console.log(`  Daily: $${formattedResults.costSummary.dailyUsd || 0}`);
        console.log(`  Monthly: $${formattedResults.costSummary.monthlyUsd || 0}`);
      }

      // Exit with error if critical vulnerabilities found
      if (formattedResults.critical > 0) {
        console.log('\n❌ CRITICAL VULNERABILITIES FOUND!');
        process.exit(2);
      }
      if (formattedResults.high > 0) {
        console.log('\n⚠️  HIGH SEVERITY VULNERABILITIES FOUND');
        process.exit(1);
      }

      console.log('\n✅ Scan completed successfully - no vulnerabilities found!');
    } catch (e) {
      console.error('❌ Failed to fetch results:', e);
      process.exit(1);
    }
  });

/**
 * Report command - Get security reports
 */
program.command('report')
  .description('Get security reports')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .option('--format <format>', 'Report format (json, html, pdf)', 'json')
  .option('--period <period>', 'Report period (day, week, month, quarter)', 'week')
  .option('--output <file>', 'Output file path', 'devpulse-report.json')
  .action(async (options) => {
    console.log('📊 DevPulse: Generating security report...\n');

    try {
      const report = await apiRequest('POST', '/trpc/compliance.getReport', {
        workspaceId: parseInt(options.workspaceId),
        period: options.period,
        format: options.format,
      }) as any;

      const fs = require('fs');
      fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
      console.log(`✅ Report saved to: ${options.output}`);
    } catch (e) {
      console.error('❌ Failed to generate report:', e);
      process.exit(1);
    }
  });

/**
 * Monitor command - Real-time monitoring
 */
const monitorCmd = program.command('monitor')
  .description('Real-time security monitoring')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .option('--duration <seconds>', 'Monitor duration in seconds', '60')
  .option('--interval <seconds>', 'Check interval in seconds', '5');

monitorCmd.action(async (options) => {
  console.log('🔭 DevPulse: Starting real-time monitoring...\n');
  console.log('Press Ctrl+C to stop\n');

  const duration = parseInt(options.duration) * 1000;
  const interval = parseInt(options.interval) * 1000;
  const startTime = Date.now();

  let lastAlerts: any[] = [];

  const monitor = async () => {
    try {
      const status = await apiRequest('GET', `/trpc/dashboard.getStats?input=${encodeURIComponent(JSON.stringify({ workspaceId: parseInt(options.workspaceId) }))}`) as any;
      
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const riskScore = status?.result?.data?.riskScore || 0;
      
      // Color based on risk
      let emoji = '🟢';
      if (riskScore >= 80) emoji = '🔴';
      else if (riskScore >= 60) emoji = '🟠';
      else if (riskScore >= 40) emoji = '🟡';

      process.stdout.write(`\r[${elapsed}s] ${emoji} Risk: ${riskScore}/100 | Alerts: ${lastAlerts.length}     `);

      // Check for new alerts
      const newAlerts = (status?.result?.data?.recentAlerts || []).filter(
        (a: any) => !lastAlerts.find((l: any) => l.id === a.id)
      );

      if (newAlerts.length > 0) {
        console.log('\n\n🚨 NEW ALERTS:');
        for (const alert of newAlerts) {
          console.log(`   [${alert.severity}] ${alert.title}`);
        }
        lastAlerts = status?.result?.data?.recentAlerts || [];
      }

    } catch (e) {
      process.stdout.write(`\r[Error: ${e}]`);
    }

    if (Date.now() - startTime < duration) {
      setTimeout(monitor, interval);
    } else {
      console.log('\n\n⏹️  Monitoring stopped.');
    }
  };

  await monitor();
});

/**
 * Agent guard command - Manage agent guard
 */
const agentCmd = program.command('agent')
  .description('Manage DevPulse AgentGuard');

agentCmd
  .command('list')
  .description('List active agents')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .action(async (options) => {
    try {
      const agents = await apiRequest('GET', `/trpc/agentGuard.listAgents?input=${encodeURIComponent(JSON.stringify({ workspaceId: parseInt(options.workspaceId) }))}`) as any;
      
      console.log('\n🤖 Active Agents:\n');
      for (const agent of agents?.result?.data || []) {
        console.log(`  ID: ${agent.agentId}`);
        console.log(`  Name: ${agent.name}`);
        console.log(`  Status: ${agent.status}`);
        console.log(`  Cost: $${agent.currentCost?.toFixed(4)} / $${agent.budgetLimit}`);
        console.log(`  Usage: ${agent.percentUsed?.toFixed(1)}%`);
        console.log('');
      }
    } catch (e) {
      console.error('❌ Failed to list agents:', e);
      process.exit(1);
    }
  });

agentCmd
  .command('kill <agentId>')
  .description('Kill/pause an agent')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .option('--reason <reason>', 'Reason for killing agent')
  .action(async (agentId, options) => {
    try {
      await apiRequest('POST', '/trpc/agentGuard.killAgent', {
        workspaceId: parseInt(options.workspaceId),
        agentId,
        reason: options.reason,
      });
      console.log(`✅ Agent ${agentId} has been paused.`);
    } catch (e) {
      console.error('❌ Failed to kill agent:', e);
      process.exit(1);
    }
  });

agentCmd
  .command('resume <agentId>')
  .description('Resume a paused agent')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .action(async (agentId, options) => {
    try {
      await apiRequest('POST', '/trpc/agentGuard.resumeAgent', {
        workspaceId: parseInt(options.workspaceId),
        agentId,
      });
      console.log(`✅ Agent ${agentId} has been resumed.`);
    } catch (e) {
      console.error('❌ Failed to resume agent:', e);
      process.exit(1);
    }
  });

/**
 * Cost command - LLM cost management
 */
const costCmd = program.command('cost')
  .description('LLM Cost Intelligence');

costCmd
  .command('summary')
  .description('Get cost summary')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .option('--period <period>', 'Period (hour, day, week, month)', 'day')
  .action(async (options) => {
    try {
      const summary = await apiRequest('GET', `/trpc/cost.getSummary?input=${encodeURIComponent(JSON.stringify({ 
        workspaceId: parseInt(options.workspaceId),
        period: options.period,
      }))}`) as any;

      const data = summary?.result?.data || {};
      
      console.log('\n💰 LLM Cost Summary\n');
      console.log(`  Period: ${options.period}`);
      console.log(`  Total Cost: $${data.totalCost?.toFixed(4)}`);
      console.log(`  Total Tokens: ${data.totalTokens?.toLocaleString()}`);
      console.log(`  Total Requests: ${data.totalRequests?.toLocaleString()}`);
      console.log('');
      console.log('  By Model:');
      for (const [model, usage] of Object.entries(data.byModel || {})) {
        const u = usage as any;
        console.log(`    ${model}: $${u.cost?.toFixed(4)} (${u.tokens?.toLocaleString()} tokens)`);
      }
    } catch (e) {
      console.error('❌ Failed to get cost summary:', e);
      process.exit(1);
    }
  });

costCmd
  .command('budget')
  .description('Manage cost budgets')
  .option('--workspace-id <id>', 'Workspace ID', config.workspaceId)
  .option('--hourly <amount>', 'Hourly budget limit')
  .option('--daily <amount>', 'Daily budget limit')
  .option('--monthly <amount>', 'Monthly budget limit')
  .action(async (options) => {
    try {
      await apiRequest('POST', '/trpc/cost.setBudget', {
        workspaceId: parseInt(options.workspaceId),
        hourlyLimit: options.hourly ? parseFloat(options.hourly) : undefined,
        dailyLimit: options.daily ? parseFloat(options.daily) : undefined,
        monthlyLimit: options.monthly ? parseFloat(options.monthly) : undefined,
      });
      console.log('✅ Budget updated successfully.');
    } catch (e) {
      console.error('❌ Failed to set budget:', e);
      process.exit(1);
    }
  });

/**
 * Config command - Configuration management
 */
program.command('config')
  .description('Configuration management')
  .action(() => {
    console.log('\n📝 DevPulse CLI Configuration\n');
    console.log(`  API URL:    ${config.apiUrl}`);
    console.log(`  Workspace:  ${config.workspaceId || '(not set)'}`);
    console.log(`  API Key:    ${config.apiKey ? '***' + config.apiKey.slice(-4) : '(not set)'}`);
    console.log('\n  Environment variables:');
    console.log('    DEVPULSE_API_URL');
    console.log('    DEVPULSE_API_KEY');
    console.log('    DEVPULSE_WORKSPACE_ID');
    console.log('\n  Config file: .devpulse/config.json');
  });

/**
 * Init command - Initialize DevPulse in a project
 */
program.command('init')
  .description('Initialize DevPulse in a project')
  .action(() => {
    const fs = require('fs');
    const path = '.devpulse/config.json';
    
    if (existsSync(path)) {
      console.log('DevPulse is already initialized in this project.');
      return;
    }

    try {
      fs.mkdirSync('.devpulse', { recursive: true });
      fs.writeFileSync(path, JSON.stringify({
        apiUrl: 'https://api.devpulse.in',
        workspaceId: '',
        apiKey: '',
      }, null, 2));
      console.log('✅ DevPulse initialized!');
      console.log('\nNext steps:');
      console.log('1. Edit .devpulse/config.json with your API key and workspace ID');
      console.log('2. Run "devpulse-cli scan" to start scanning');
      console.log('3. Add DevPulse to your CI/CD pipeline');
    } catch (e) {
      console.error('❌ Failed to initialize:', e);
      process.exit(1);
    }
  });

// Parse and execute
program.parse(process.argv);
