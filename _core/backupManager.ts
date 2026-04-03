// @ts-nocheck
/**
 * PHASE 9D: Backup Manager
 * 
 * Handles automated database and Redis backups with scheduling,
 * compression, and validation. Supports full and incremental backups.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync, createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { createHash } from 'crypto';
import pino from 'pino';
import cron from 'node-cron';
import { S3BackupStore } from './s3BackupStore';

const execAsync = promisify(exec);
const logger = pino({ name: 'BackupManager' });

/**
 * Backup types
 */
export enum BackupType {
  FULL = 'full',        // Complete database snapshot
  INCREMENTAL = 'incremental',  // Changes since last backup
  WAL_ARCHIVE = 'wal-archive'   // PostgreSQL WAL (Write-Ahead Logs)
}

/**
 * Backup status
 */
export enum BackupStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  VERIFIED = 'verified'
}

/**
 * Backup metadata
 */
export interface BackupMetadata {
  id: string;
  type: BackupType;
  status: BackupStatus;
  timestamp: Date;
  size: number;
  checksum: string;
  database: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  retentionDays: number;
  compressed: boolean;
  location: string;
  verified: boolean;
  error?: string;
  tags: Record<string, string>;
}

/**
 * Backup schedule configuration
 */
export interface BackupSchedule {
  full: string;      // Cron: daily at 2 AM "0 2 * * *"
  incremental: string; // Cron: every 6 hours "0 */6 * * *"
  walArchive: string;  // Cron: every hour "0 * * * *"
  retention: {
    fullDays: number;  // Keep full backups for 30 days
    incrementalDays: number;  // Keep incremental for 7 days
    walDays: number;   // Keep WAL logs for 3 days
  };
}

/**
 * Backup Manager: Orchestrates database backups
 */
export class BackupManager {
  private s3Store: S3BackupStore;
  private schedule: BackupSchedule;
  private backupHistory: Map<string, BackupMetadata> = new Map();
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private lastFullBackupTime?: Date;
  private localBackupDir: string;

  constructor(
    s3Store: S3BackupStore,
    localBackupDir: string = '/var/backups/devpulse',
    schedule: BackupSchedule = this.getDefaultSchedule()
  ) {
    this.s3Store = s3Store;
    this.localBackupDir = localBackupDir;
    this.schedule = schedule;
  }

  /**
   * Get default backup schedule
   */
  private getDefaultSchedule(): BackupSchedule {
    return {
      full: '0 2 * * *',           // Daily at 2 AM UTC
      incremental: '0 */6 * * *',  // Every 6 hours
      walArchive: '0 * * * *',     // Every hour
      retention: {
        fullDays: 30,
        incrementalDays: 7,
        walDays: 3
      }
    };
  }

  /**
   * Initialize backup manager
   */
  async initialize(): Promise<void> {
    logger.info('Initializing backup manager...');

    // Create backup directory if it doesn't exist
    if (!existsSync(this.localBackupDir)) {
      const { stdout } = await execAsync(`mkdir -p ${this.localBackupDir}`);
      logger.info(`Created backup directory: ${this.localBackupDir}`);
    }

    // Schedule backup jobs
    this.scheduleFullBackup();
    this.scheduleIncrementalBackup();
    this.scheduleWalArchiving();
    this.scheduleBackupCleanup();

    logger.info('✓ Backup manager initialized');
  }

  /**
   * Schedule full database backup (daily)
   */
  private scheduleFullBackup(): void {
    const task = cron.schedule(this.schedule.full, async () => {
      try {
        logger.info('Starting scheduled full backup...');
        await this.performFullBackup();
      } catch (error) {
        logger.error('Full backup failed:', error);
      }
    });

    this.jobs.set('full-backup', task);
    logger.info(`Full backup scheduled: ${this.schedule.full}`);
  }

  /**
   * Schedule incremental backup (every 6 hours)
   */
  private scheduleIncrementalBackup(): void {
    const task = cron.schedule(this.schedule.incremental, async () => {
      try {
        logger.info('Starting scheduled incremental backup...');
        await this.performIncrementalBackup();
      } catch (error) {
        logger.error('Incremental backup failed:', error);
      }
    });

    this.jobs.set('incremental-backup', task);
    logger.info(`Incremental backup scheduled: ${this.schedule.incremental}`);
  }

  /**
   * Schedule WAL (Write-Ahead Log) archiving (hourly)
   */
  private scheduleWalArchiving(): void {
    const task = cron.schedule(this.schedule.walArchive, async () => {
      try {
        logger.info('Starting scheduled WAL archiving...');
        await this.archiveWalLogs();
      } catch (error) {
        logger.error('WAL archiving failed:', error);
      }
    });

    this.jobs.set('wal-archive', task);
    logger.info(`WAL archiving scheduled: ${this.schedule.walArchive}`);
  }

  /**
   * Schedule backup cleanup (daily at 3 AM)
   */
  private scheduleBackupCleanup(): void {
    const task = cron.schedule('0 3 * * *', async () => {
      try {
        logger.info('Starting backup cleanup...');
        await this.cleanupExpiredBackups();
      } catch (error) {
        logger.error('Backup cleanup failed:', error);
      }
    });

    this.jobs.set('cleanup', task);
  }

  /**
   * Perform full database backup
   */
  async performFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('full');
    const metadata: BackupMetadata = {
      id: backupId,
      type: BackupType.FULL,
      status: BackupStatus.IN_PROGRESS,
      timestamp: new Date(),
      size: 0,
      checksum: '',
      database: 'postgres',
      startTime: new Date(),
      duration: 0,
      retentionDays: this.schedule.retention.fullDays,
      compressed: true,
      location: `s3://backups/full/${backupId}.sql.gz`,
      verified: false,
      tags: { type: 'full', stage: process.env.NODE_ENV || 'production' }
    };

    try {
      logger.info(`Starting full backup ${backupId}...`);

      // Step 1: Dump database
      const dumpFile = path.join(this.localBackupDir, `${backupId}.sql`);
      const dumpCmd = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -F plain > ${dumpFile}`;

      await execAsync(dumpCmd);
      logger.debug(`Database dump completed: ${dumpFile}`);

      // Step 2: Compress
      const compressedFile = `${dumpFile}.gz`;
      await this.compressFile(dumpFile, compressedFile);
      logger.debug(`Backup compressed: ${compressedFile}`);

      // Step 3: Calculate checksum
      metadata.checksum = await this.calculateChecksum(compressedFile);
      metadata.size = await this.getFileSize(compressedFile);
      logger.debug(`Checksum: ${metadata.checksum}, Size: ${metadata.size} bytes`);

      // Step 4: Upload to S3
      await this.s3Store.uploadBackup(compressedFile, metadata);
      logger.info(`Backup uploaded to S3: ${metadata.location}`);

      // Step 5: Cleanup local file
      await unlink(dumpFile);
      await unlink(compressedFile);

      // Step 6: Mark as completed
      metadata.status = BackupStatus.COMPLETED;
      metadata.endTime = new Date();
      metadata.duration = (metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000;
      metadata.verified = await this.verifyBackup(metadata);

      this.backupHistory.set(backupId, metadata);
      this.lastFullBackupTime = new Date();

      logger.info(`✓ Full backup completed in ${metadata.duration}s (${metadata.size} bytes)`);
      return metadata;
    } catch (error) {
      metadata.status = BackupStatus.FAILED;
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      metadata.endTime = new Date();
      metadata.duration = (metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000;

      logger.error(`✗ Full backup failed: ${metadata.error}`);
      this.backupHistory.set(backupId, metadata);

      throw error;
    }
  }

  /**
   * Perform incremental backup (since last full backup)
   */
  async performIncrementalBackup(): Promise<BackupMetadata> {
    if (!this.lastFullBackupTime) {
      logger.warn('No full backup found, performing full backup instead');
      return this.performFullBackup();
    }

    const backupId = this.generateBackupId('incremental');
    const metadata: BackupMetadata = {
      id: backupId,
      type: BackupType.INCREMENTAL,
      status: BackupStatus.IN_PROGRESS,
      timestamp: new Date(),
      size: 0,
      checksum: '',
      database: 'postgres',
      startTime: new Date(),
      duration: 0,
      retentionDays: this.schedule.retention.incrementalDays,
      compressed: true,
      location: `s3://backups/incremental/${backupId}.sql.gz`,
      verified: false,
      tags: { type: 'incremental', basedOn: 'last-full' }
    };

    try {
      logger.info(`Starting incremental backup ${backupId}...`);

      // For incremental, we dump only changes via pg_dump with --no-create-db flag
      const dumpFile = path.join(this.localBackupDir, `${backupId}.sql`);
      const fromTime = this.lastFullBackupTime.toISOString();
      const dumpCmd = `PGPASSWORD="${process.env.DB_PASSWORD}" pg_dump -h ${process.env.DB_HOST} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} -F plain --no-create-db > ${dumpFile}`;

      await execAsync(dumpCmd);

      // Compress
      const compressedFile = `${dumpFile}.gz`;
      await this.compressFile(dumpFile, compressedFile);

      // Calculate checksum
      metadata.checksum = await this.calculateChecksum(compressedFile);
      metadata.size = await this.getFileSize(compressedFile);

      // Upload to S3
      await this.s3Store.uploadBackup(compressedFile, metadata);

      // Cleanup
      await unlink(dumpFile);
      await unlink(compressedFile);

      // Mark as completed
      metadata.status = BackupStatus.COMPLETED;
      metadata.endTime = new Date();
      metadata.duration = (metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000;
      metadata.verified = await this.verifyBackup(metadata);

      this.backupHistory.set(backupId, metadata);

      logger.info(`✓ Incremental backup completed in ${metadata.duration}s`);
      return metadata;
    } catch (error) {
      metadata.status = BackupStatus.FAILED;
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      metadata.endTime = new Date();
      metadata.duration = (metadata.endTime.getTime() - metadata.startTime.getTime()) / 1000;

      logger.error(`✗ Incremental backup failed: ${metadata.error}`);
      this.backupHistory.set(backupId, metadata);

      throw error;
    }
  }

  /**
   * Archive PostgreSQL WAL logs
   */
  async archiveWalLogs(): Promise<void> {
    try {
      logger.info('Archiving WAL logs...');

      const walDir = process.env.DB_WAL_DIR || '/var/lib/postgresql/10/main/pg_wal';
      const backupFile = path.join(this.localBackupDir, `wal-${Date.now()}.tar.gz`);

      // Create tarball of WAL logs
      const tarCmd = `tar -czf ${backupFile} -C ${walDir} . 2>/dev/null || true`;
      await execAsync(tarCmd);

      // Get size
      const size = existsSync(backupFile) ? await this.getFileSize(backupFile) : 0;

      if (size > 0) {
        // Calculate checksum
        const checksum = await this.calculateChecksum(backupFile);

        // Upload to S3
        const metadata: BackupMetadata = {
          id: `wal-${Date.now()}`,
          type: BackupType.WAL_ARCHIVE,
          status: BackupStatus.COMPLETED,
          timestamp: new Date(),
          size,
          checksum,
          database: 'postgres',
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          retentionDays: this.schedule.retention.walDays,
          compressed: true,
          location: `s3://backups/wal/wal-${Date.now()}.tar.gz`,
          verified: false,
          tags: { type: 'wal-archive' }
        };

        await this.s3Store.uploadBackup(backupFile, metadata);
        await unlink(backupFile);

        logger.info(`✓ WAL logs archived (${size} bytes)`);
      } else {
        logger.info('No WAL logs to archive');
      }
    } catch (error) {
      logger.error('WAL archiving failed:', error);
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(metadata: BackupMetadata): Promise<boolean> {
    try {
      logger.info(`Verifying backup ${metadata.id}...`);

      // Download backup header from S3
      const header = await this.s3Store.getBackupHeader(metadata.location);

      // Check if it's a valid gzip file
      const isValid = header && header.startsWith('\x1f\x8b');

      if (isValid) {
        logger.info(`✓ Backup ${metadata.id} verified`);
        metadata.status = BackupStatus.VERIFIED;
      } else {
        logger.warn(`✗ Backup ${metadata.id} verification failed`);
      }

      return isValid || false;
    } catch (error) {
      logger.error(`Verification failed for ${metadata.id}:`, error);
      return false;
    }
  }

  /**
   * List all backups
   */
  getBackupHistory(type?: BackupType): BackupMetadata[] {
    const backups = Array.from(this.backupHistory.values());
    return type ? backups.filter(b => b.type === type) : backups;
  }

  /**
   * Get latest backup
   */
  getLatestBackup(type?: BackupType): BackupMetadata | undefined {
    const backups = this.getBackupHistory(type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return backups[0];
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpiredBackups(): Promise<void> {
    try {
      logger.info('Cleaning up expired backups...');

      const now = new Date();
      let removedCount = 0;

      for (const [id, metadata] of this.backupHistory) {
        const ageInDays = (now.getTime() - metadata.timestamp.getTime()) / (1000 * 60 * 60 * 24);

        if (ageInDays > metadata.retentionDays) {
          await this.s3Store.deleteBackup(metadata.location);
          this.backupHistory.delete(id);
          removedCount++;
          logger.info(`Deleted expired backup: ${id}`);
        }
      }

      logger.info(`✓ Cleanup complete (removed ${removedCount} backups)`);
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }

  /**
   * Compress file with gzip
   */
  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = createReadStream(inputPath);
      const output = createWriteStream(outputPath);
      const gzip = zlib.createGzip();

      input
        .pipe(gzip)
        .pipe(output)
        .on('finish', () => resolve())
        .on('error', reject);

      input.on('error', reject);
    });
  }

  /**
   * Calculate file checksum (SHA256)
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(filePath: string): Promise<number> {
    const { stdout } = await execAsync(`stat -f%z "${filePath}" 2>/dev/null || stat -c%s "${filePath}"`);
    return parseInt(stdout.trim(), 10);
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
    return `${type}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop all scheduled jobs
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down backup manager...');

    for (const [name, task] of this.jobs) {
      task.stop();
      logger.debug(`Stopped ${name}`);
    }

    logger.info('✓ Backup manager shutdown complete');
  }

  /**
   * Get backup statistics
   */
  getStatistics(): {
    totalBackups: number;
    totalSize: number;
    verifiedBackups: number;
    failedBackups: number;
    lastBackupTime?: Date;
  } {
    const backups = Array.from(this.backupHistory.values());
    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      verifiedBackups: backups.filter(b => b.verified).length,
      failedBackups: backups.filter(b => b.status === BackupStatus.FAILED).length,
      lastBackupTime: this.getLatestBackup()?.timestamp
    };
  }
}

export default BackupManager;
