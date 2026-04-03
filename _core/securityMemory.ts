/**
 * DevPulse Security Memory System
 * 
 * Inspired by Claude Code's memdir.ts with security-focused memory types:
 * - Persistent security context for agents
 * - Security findings memory
 * - Compliance rules memory
 * - Vulnerability patterns memory
 * 
 * @module DevPulse/SecurityMemory
 */

import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';

export const MEMORY_ENTRYPOINT_NAME = 'SECURITY_MEMORY.md';
export const MAX_MEMORY_LINES = 200;
export const MAX_MEMORY_BYTES = 25000;

export type SecurityMemoryType = 'vulnerability' | 'compliance' | 'pattern' | 'config' | 'user_preference';

export interface SecurityMemory {
  title: string;
  description: string;
  type: SecurityMemoryType;
  tags: string[];
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cweId?: string;
  cvssScore?: number;
  createdAt: string;
  updatedAt: string;
  filePath?: string;
}

export interface MemoryEntrypointTruncation {
  content: string;
  lineCount: number;
  byteCount: number;
  wasLineTruncated: boolean;
  wasByteTruncated: boolean;
}

/**
 * Get memory directory path for a workspace
 */
export function getSecurityMemPath(workspaceId: number, baseDir?: string): string {
  const base = baseDir || process.env.DEVPULSE_MEMORY_DIR || join(process.cwd(), '.devpulse');
  return join(base, `workspace-${workspaceId}`, 'security-memory');
}

/**
 * Ensure memory directory exists
 */
export function ensureMemoryDirExists(memoryDir: string): void {
  try {
    mkdirSync(memoryDir, { recursive: true });
  } catch (e) {
    // Directory already exists or real permission error
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      console.error(`[SecurityMemory] Failed to create directory ${memoryDir}:`, err);
    }
  }
}

/**
 * Truncate memory content to line and byte caps
 */
export function truncateMemoryContent(raw: string): MemoryEntrypointTruncation {
  const trimmed = raw.trim();
  const contentLines = trimmed.split('\n');
  const lineCount = contentLines.length;
  const byteCount = trimmed.length;

  const wasLineTruncated = lineCount > MAX_MEMORY_LINES;
  const wasByteTruncated = byteCount > MAX_MEMORY_BYTES;

  if (!wasLineTruncated && !wasByteTruncated) {
    return {
      content: trimmed,
      lineCount,
      byteCount,
      wasLineTruncated,
      wasByteTruncated,
    };
  }

  let truncated = wasLineTruncated
    ? contentLines.slice(0, MAX_MEMORY_LINES).join('\n')
    : trimmed;

  if (truncated.length > MAX_MEMORY_BYTES) {
    const cutAt = truncated.lastIndexOf('\n', MAX_MEMORY_BYTES);
    truncated = truncated.slice(0, cutAt > 0 ? cutAt : MAX_MEMORY_BYTES);
  }

  const reason =
    wasByteTruncated && !wasLineTruncated
      ? `${byteCount} bytes (limit: ${MAX_MEMORY_BYTES})`
      : wasLineTruncated && !wasByteTruncated
        ? `${lineCount} lines (limit: ${MAX_MEMORY_LINES})`
        : `${lineCount} lines and ${byteCount} bytes`;

  return {
    content:
      truncated +
      `\n\n> WARNING: ${MEMORY_ENTRYPOINT_NAME} is ${reason}. Only part was loaded.`,
    lineCount,
    byteCount,
    wasLineTruncated,
    wasByteTruncated,
  };
}

/**
 * Build memory frontmatter for a security memory entry
 */
export function buildMemoryFrontmatter(memory: SecurityMemory): string {
  const lines = [
    '---',
    `title: "${memory.title}"`,
    `description: "${memory.description.replace(/"/g, '\\"')}"`,
    `type: ${memory.type}`,
    `tags: [${memory.tags.map(t => `"${t}"`).join(', ')}]`,
  ];

  if (memory.severity) {
    lines.push(`severity: ${memory.severity}`);
  }
  if (memory.cweId) {
    lines.push(`cweId: ${memory.cweId}`);
  }
  if (memory.cvssScore !== undefined) {
    lines.push(`cvssScore: ${memory.cvssScore}`);
  }
  lines.push(`createdAt: ${memory.createdAt}`);
  lines.push(`updatedAt: ${memory.updatedAt}`);

  lines.push('---');
  return lines.join('\n');
}

/**
 * Parse memory frontmatter from content
 */
export function parseMemoryFrontmatter(content: string): SecurityMemory | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');

  const lines = frontmatter.split('\n');
  const data: Record<string, string> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Parse array
      value = value;
    }

    data[key] = value;
  }

  // Parse tags array
  const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim().replace(/"/g, ''))
    : [];

  return {
    title: data.title || 'Untitled',
    description: data.description || '',
    type: (data.type as SecurityMemoryType) || 'vulnerability',
    tags,
    severity: data.severity as SecurityMemory['severity'],
    cweId: data.cweId,
    cvssScore: data.cvssScore ? parseFloat(data.cvssScore) : undefined,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    filePath: undefined,
  };
}

/**
 * Save a security memory to a file
 */
export async function saveSecurityMemory(
  workspaceId: number,
  memory: SecurityMemory,
  baseDir?: string
): Promise<string> {
  const memoryDir = getSecurityMemPath(workspaceId, baseDir);
  ensureMemoryDirExists(memoryDir);

  // Generate filename from title
  const safeTitle = memory.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  const timestamp = Date.now();
  const filename = `${safeTitle}-${timestamp}.md`;
  const filepath = join(memoryDir, filename);

  const content = buildMemoryFrontmatter(memory) + '\n\n' + (memory.description || '');

  try {
    writeFileSync(filepath, content, 'utf-8');
    console.log(`[SecurityMemory] Saved: ${filepath}`);

    // Update index
    await updateMemoryIndex(workspaceId, {
      title: memory.title,
      file: filename,
      type: memory.type,
      severity: memory.severity,
    }, baseDir);

    return filepath;
  } catch (e) {
    console.error(`[SecurityMemory] Failed to save memory:`, e);
    throw e;
  }
}

/**
 * Update memory index with new entry
 */
async function updateMemoryIndex(
  workspaceId: number,
  entry: { title: string; file: string; type: string; severity?: string },
  baseDir?: string
): Promise<void> {
  const memoryDir = getSecurityMemPath(workspaceId, baseDir);
  const indexPath = join(memoryDir, MEMORY_ENTRYPOINT_NAME);

  let existingIndex = '';
  if (existsSync(indexPath)) {
    existingIndex = readFileSync(indexPath, 'utf-8');
  } else {
    existingIndex = `# Security Memory Index\n\n## Types\n- vulnerability: Known vulnerabilities and their patterns\n- compliance: Compliance rules and mappings\n- pattern: Attack patterns and detection rules\n- config: Security configuration best practices\n- user_preference: User preferences for security scanning\n\n---\n\n`;
  }

  // Add new entry
  const severity = entry.severity ? ` [${entry.severity.toUpperCase()}]` : '';
  const newEntry = `- [${entry.title}${severity}](${entry.file}) — ${entry.type}\n`;

  // Insert before the closing line if exists
  if (existingIndex.includes('\n##')) {
    existingIndex = existingIndex.replace('\n##', newEntry + '\n##');
  } else {
    existingIndex += newEntry;
  }

  writeFileSync(indexPath, existingIndex, 'utf-8');
}

/**
 * Load security memory index
 */
export function loadSecurityMemoryIndex(workspaceId: number, baseDir?: string): MemoryEntrypointTruncation {
  const memoryDir = getSecurityMemPath(workspaceId, baseDir);
  const indexPath = join(memoryDir, MEMORY_ENTRYPOINT_NAME);

  if (!existsSync(indexPath)) {
    return {
      content: '# Security Memory Index\n\nNo security memories saved yet.',
      lineCount: 0,
      byteCount: 0,
      wasLineTruncated: false,
      wasByteTruncated: false,
    };
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    return truncateMemoryContent(content);
  } catch (e) {
    console.error(`[SecurityMemory] Failed to load index:`, e);
    return {
      content: '',
      lineCount: 0,
      byteCount: 0,
      wasLineTruncated: false,
      wasByteTruncated: false,
    };
  }
}

/**
 * Load all security memories
 */
export function loadAllSecurityMemories(workspaceId: number, baseDir?: string): SecurityMemory[] {
  const memoryDir = getSecurityMemPath(workspaceId, baseDir);

  if (!existsSync(memoryDir)) {
    return [];
  }

  const memories: SecurityMemory[] = [];

  try {
    const files = readdirSync(memoryDir);

    for (const file of files) {
      if (!file.endsWith('.md') || file === MEMORY_ENTRYPOINT_NAME) {
        continue;
      }

      const filepath = join(memoryDir, file);
      try {
        const content = readFileSync(filepath, 'utf-8');
        const memory = parseMemoryFrontmatter(content);
        if (memory) {
          memory.filePath = filepath;
          memories.push(memory);
        }
      } catch (e) {
        console.warn(`[SecurityMemory] Failed to read ${file}:`, e);
      }
    }
  } catch (e) {
    console.error(`[SecurityMemory] Failed to list memory files:`, e);
  }

  return memories;
}

/**
 * Delete a security memory
 */
export function deleteSecurityMemory(workspaceId: number, filename: string, baseDir?: string): boolean {
  const memoryDir = getSecurityMemPath(workspaceId, baseDir);
  const filepath = join(memoryDir, filename);

  try {
    const { unlinkSync, existsSync } = require('fs');
    if (existsSync(filepath)) {
      unlinkSync(filepath);
      console.log(`[SecurityMemory] Deleted: ${filepath}`);

      // Update index
      const indexPath = join(memoryDir, MEMORY_ENTRYPOINT_NAME);
      if (existsSync(indexPath)) {
        let index = readFileSync(indexPath, 'utf-8');
        // Remove the entry line
        index = index.replace(new RegExp(`- \\[.*?\\]\\(${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\).*?\\n`), '');
        writeFileSync(indexPath, index, 'utf-8');
      }

      return true;
    }
    return false;
  } catch (e) {
    console.error(`[SecurityMemory] Failed to delete memory:`, e);
    return false;
  }
}

/**
 * Search security memories by keyword
 */
export function searchSecurityMemories(
  workspaceId: number,
  query: string,
  baseDir?: string
): SecurityMemory[] {
  const memories = loadAllSecurityMemories(workspaceId, baseDir);
  const queryLower = query.toLowerCase();

  return memories.filter(memory =>
    memory.title.toLowerCase().includes(queryLower) ||
    memory.description.toLowerCase().includes(queryLower) ||
    memory.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
    memory.cweId?.toLowerCase().includes(queryLower)
  );
}

/**
 * Get memories by type
 */
export function getMemoriesByType(
  workspaceId: number,
  type: SecurityMemoryType,
  baseDir?: string
): SecurityMemory[] {
  const memories = loadAllSecurityMemories(workspaceId, baseDir);
  return memories.filter(m => m.type === type);
}

/**
 * Get memories by severity
 */
export function getMemoriesBySeverity(
  workspaceId: number,
  severity: SecurityMemory['severity'],
  baseDir?: string
): SecurityMemory[] {
  const memories = loadAllSecurityMemories(workspaceId, baseDir);
  return memories.filter(m => m.severity === severity);
}

/**
 * Build memory prompt for AI agent context
 */
export function buildSecurityMemoryPrompt(workspaceId: number, baseDir?: string): string {
  const memoryDir = getSecurityMemPath(workspaceId, baseDir);
  const index = loadSecurityMemoryIndex(workspaceId, baseDir);

  const lines: string[] = [
    `# Security Memory`,
    '',
    `You have persistent security context at \`${memoryDir}\`.`,
    '',
    '## Memory Types',
    '- **vulnerability**: Known vulnerabilities, their patterns, and remediation',
    '- **compliance**: Compliance rules, frameworks, and mappings',
    '- **pattern**: Attack patterns, detection rules, IOCs',
    '- **config**: Security configuration best practices',
    '- **user_preference**: User preferences for security scanning',
    '',
    '## When to Save',
    '- When a new vulnerability type is discovered in the codebase',
    '- When compliance requirements change',
    '- When attack patterns are identified',
    '- When security configurations are optimized',
    '',
    `## ${MEMORY_ENTRYPOINT_NAME}`,
    '',
    index.content,
    '',
    '## When to Access',
    '- When starting a new security scan',
    '- When analyzing a potential vulnerability',
    '- When checking compliance requirements',
    '- When reviewing attack patterns',
  ];

  return lines.join('\n');
}

/**
 * Auto-save vulnerability findings to memory
 */
export async function autoSaveVulnerabilityMemory(
  workspaceId: number,
  vulnerability: {
    title: string;
    description: string;
    cweId?: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    tags: string[];
    endpoint?: string;
  }
): Promise<string> {
  const memory: SecurityMemory = {
    title: vulnerability.title,
    description: vulnerability.description,
    type: 'vulnerability',
    tags: ['auto-saved', ...vulnerability.tags],
    severity: vulnerability.severity,
    cweId: vulnerability.cweId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (vulnerability.endpoint) {
    memory.description += `\n\nEndpoint: \`${vulnerability.endpoint}\``;
  }

  return saveSecurityMemory(workspaceId, memory);
}

/**
 * Auto-save compliance mapping to memory
 */
export async function autoSaveComplianceMemory(
  workspaceId: number,
  compliance: {
    title: string;
    description: string;
    framework: string;
    requirement?: string;
  }
): Promise<string> {
  const memory: SecurityMemory = {
    title: compliance.title,
    description: compliance.description,
    type: 'compliance',
    tags: ['auto-saved', compliance.framework.toLowerCase()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (compliance.requirement) {
    memory.description += `\n\nRequirement: ${compliance.requirement}`;
  }

  return saveSecurityMemory(workspaceId, memory);
}

/**
 * Get memory statistics
 */
export function getMemoryStats(workspaceId: number, baseDir?: string): {
  totalMemories: number;
  byType: Record<SecurityMemoryType, number>;
  bySeverity: Record<string, number>;
  oldestMemory?: string;
  newestMemory?: string;
} {
  const memories = loadAllSecurityMemories(workspaceId, baseDir);

  const byType: Record<SecurityMemoryType, number> = {
    vulnerability: 0,
    compliance: 0,
    pattern: 0,
    config: 0,
    user_preference: 0,
  };

  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  let oldestMemory: string | undefined;
  let newestMemory: string | undefined;

  for (const memory of memories) {
    byType[memory.type]++;
    if (memory.severity) {
      bySeverity[memory.severity]++;
    }

    if (!oldestMemory || memory.createdAt < oldestMemory) {
      oldestMemory = memory.createdAt;
    }
    if (!newestMemory || memory.createdAt > newestMemory) {
      newestMemory = memory.createdAt;
    }
  }

  return {
    totalMemories: memories.length,
    byType,
    bySeverity,
    oldestMemory,
    newestMemory,
  };
}
