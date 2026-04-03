#!/usr/bin/env node
/**
 * DevPulse CLI Tool
 * =================
 * Command-line interface for DevPulse CI/CD integration
 */

import { Command } from 'commander';
import fs from 'fs';

const program = new Command();

program
  .name('devpulse-cli')
  .description('DevPulse CLI for CI/CD integration')
  .version('1.0.0');

program
  .command('scan')
  .requiredOption('--workspace-id <id>', 'Workspace ID')
  .requiredOption('--api-key <key>', 'DevPulse API key')
  .option('--commit <sha>', 'Git commit SHA')
  .option('--output <file>', 'Output file path', 'devpulse-results.json')
  .option('--timeout <seconds>', 'Scan timeout', '300')
  .option('--api-url <url>', 'DevPulse API URL', process.env.DEVPULSE_API_URL || 'https://api.devpulse.in')
  .action(async (options: any) => {
    const baseUrl = options.apiUrl.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    };
    
    process.stdout.write('DevPulse: Starting security scan...\n');
    
    let scanId: number;
    
    try {
      const startRes = await fetch(`${baseUrl}/trpc/scan.startCiScan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId: parseInt(options.workspaceId),
          commitSha: options.commit,
          source: 'github_actions',
        }),
      });
      
      const startData = await startRes.json() as any;
      scanId = startData?.result?.data?.scanId;
      
      if (!scanId) throw new Error('Failed to start scan');
      
      process.stdout.write(`DevPulse: Scan started (ID: ${scanId})\n`);
    } catch (err) {
      process.stderr.write(`DevPulse: Failed to start scan: ${err}\n`);
      fs.writeFileSync(options.output, JSON.stringify({ error: true, message: String(err) }));
      process.exit(0);
    }
    
    const timeout = parseInt(options.timeout) * 1000;
    const startTime = Date.now();
    let status = 'pending';
    let progress = 0;
    
    while (status === 'pending' || status === 'running') {
      if (Date.now() - startTime > timeout) {
        process.stderr.write('DevPulse: Scan timed out\n');
        break;
      }
      
      await new Promise(r => setTimeout(r, 5000));
      
      try {
        const pollRes = await fetch(`${baseUrl}/trpc/scan.getScanStatus?input=${encodeURIComponent(JSON.stringify({ scanId }))}`, { headers });
        const pollData = await pollRes.json() as any;
        status = pollData?.result?.data?.status;
        progress = pollData?.result?.data?.progress || progress;
        process.stdout.write(`DevPulse: Progress ${progress}% (${status})\n`);
      } catch {}
    }
    
    try {
      const resultsRes = await fetch(`${baseUrl}/trpc/scan.getScanResults?input=${encodeURIComponent(JSON.stringify({ scanId }))}`, { headers });
      const resultsData = await resultsRes.json() as any;
      const results = resultsData?.result?.data;
      
      fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
      process.stdout.write(`DevPulse: Scan complete. Found ${results?.vulnerabilityCount || 0} vulnerabilities.\n`);
    } catch (err) {
      fs.writeFileSync(options.output, JSON.stringify({ error: true, message: String(err) }));
    }
  });

program
  .command('import-postman')
  .requiredOption('--workspace-id <id>', 'Workspace ID')
  .requiredOption('--api-key <key>', 'DevPulse API key')
  .requiredOption('--file <path>', 'Postman collection JSON file path')
  .option('--api-url <url>', 'DevPulse API URL', process.env.DEVPULSE_API_URL || 'https://api.devpulse.in')
  .option('--auto-scan', 'Automatically run scan after import', true)
  .action(async (options: any) => {
    const baseUrl = options.apiUrl.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    };
    
    process.stdout.write('DevPulse: Importing Postman collection...\n');
    
    let collectionJson: string;
    try {
      collectionJson = fs.readFileSync(options.file, 'utf-8');
    } catch (err) {
      process.stderr.write(`DevPulse: Failed to read file: ${err}\n`);
      process.exit(1);
    }
    
    try {
      const res = await fetch(`${baseUrl}/trpc/postman.importCollection`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId: parseInt(options.workspaceId),
          collectionJson,
          autoScan: options.autoScan,
        }),
      });
      
      const data = await res.json() as any;
      const result = data?.result?.data;
      
      process.stdout.write(`DevPulse: Imported ${result?.totalEndpoints || 0} endpoints from "${result?.collectionName || 'collection'}".\n`);
      process.stdout.write(`DevPulse: Scan ID: ${result?.scanId}\n`);
      process.stdout.write(`DevPulse: ${result?.message || 'Analysis running in background.'}\n`);
    } catch (err) {
      process.stderr.write(`DevPulse: Import failed: ${err}\n`);
      process.exit(1);
    }
  });

program
  .command('health')
  .option('--api-url <url>', 'DevPulse API URL', process.env.DEVPULSE_API_URL || 'https://api.devpulse.in')
  .action(async (options: any) => {
    const baseUrl = options.apiUrl.replace(/\/$/, '');
    
    try {
      const res = await fetch(`${baseUrl}/health`);
      const data = await res.json();
      
      process.stdout.write('DevPulse API Health:\n');
      process.stdout.write(`  Status: ${data.ok ? '✅ OK' : '❌ FAILED'}\n`);
      process.stdout.write(`  Service: ${data.service}\n`);
      process.stdout.write(`  Patents: ${data.patents}\n`);
      
      if (!data.ok) {
        process.exit(1);
      }
    } catch (err) {
      process.stderr.write(`DevPulse: Health check failed: ${err}\n`);
      process.exit(1);
    }
  });

program.parse();
