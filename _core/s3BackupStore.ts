// @ts-nocheck
/**
 * PHASE 9D: S3 Backup Store
 * 
 * Handles backup storage in AWS S3 with encryption, versioning,
 * and lifecycle policies for cost optimization.
 */

import AWS from 'aws-sdk';
import { createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import pino from 'pino';
import { BackupMetadata } from './backupManager';

const logger = pino({ name: 'S3BackupStore' });

/**
 * S3 Backup Store configuration
 */
export interface S3BackupConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  encryptionKey?: string;
  storageClass?: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
  enableVersioning?: boolean;
  enableLifecycle?: boolean;
}

/**
 * Backup location in S3
 */
export interface BackupLocation {
  bucket: string;
  prefix: string;
  key: string;
  url: string;
  size: number;
  lastModified: Date;
  eTag: string;
  storageClass: string;
}

/**
 * S3 Backup Store: Manages backup storage in AWS S3
 */
export class S3BackupStore {
  private s3: AWS.S3;
  private bucket: string;
  private config: S3BackupConfig;
  private uploadedBackups: Map<string, BackupLocation> = new Map();

  constructor(config: S3BackupConfig) {
    this.config = config;
    this.bucket = config.bucket;

    // Initialize S3 client
    this.s3 = new AWS.S3({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region
    });
  }

  /**
   * Initialize S3 backup store
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing S3 backup store (bucket: ${this.bucket})...`);

    try {
      // Check if bucket exists
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
      logger.info('✓ S3 bucket exists');
    } catch (error: any) {
      if (error.code === 'NoSuchBucket') {
        // Create bucket if it doesn't exist
        logger.info('Creating S3 bucket...');
        await this.s3.createBucket({ Bucket: this.bucket }).promise();
        logger.info('✓ S3 bucket created');
      } else if (error.code === 'Forbidden') {
        logger.error('No permission to access S3 bucket');
        throw error;
      } else {
        throw error;
      }
    }

    // Enable versioning for disaster recovery
    if (this.config.enableVersioning !== false) {
      await this.enableVersioning();
    }

    // Enable lifecycle policies for cost optimization
    if (this.config.enableLifecycle !== false) {
      await this.setupLifecyclePolicies();
    }

    // Enable server-side encryption
    if (this.config.encryptionKey) {
      await this.enableEncryption();
    }

    logger.info('✓ S3 backup store initialized');
  }

  /**
   * Upload backup file to S3
   */
  async uploadBackup(filePath: string, metadata: BackupMetadata): Promise<BackupLocation> {
    try {
      logger.info(`Uploading backup ${metadata.id} to S3...`);

      const fileName = path.basename(filePath);
      const s3Key = this.getS3Key(metadata);

      // Upload file as stream
      const fileStream = createReadStream(filePath);

      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: s3Key,
        Body: fileStream,
        ContentType: 'application/gzip',
        Metadata: {
          'backup-id': metadata.id,
          'backup-type': metadata.type,
          'backup-timestamp': metadata.timestamp.toISOString(),
          'backup-checksum': metadata.checksum,
          'database': metadata.database
        },
        ServerSideEncryption: this.config.encryptionKey ? 'aws:kms' : 'AES256',
        StorageClass: this.config.storageClass || 'STANDARD'
      };

      // Add KMS encryption if configured
      if (this.config.encryptionKey) {
        params.SSEKMSKeyId = this.config.encryptionKey;
        params.ServerSideEncryption = 'aws:kms';
      }

      const result = await this.s3.upload(params).promise();

      const location: BackupLocation = {
        bucket: this.bucket,
        prefix: `backups/${metadata.type}`,
        key: s3Key,
        url: `s3://${this.bucket}/${s3Key}`,
        size: metadata.size,
        lastModified: new Date(),
        eTag: result.ETag,
        storageClass: params.StorageClass || 'STANDARD'
      };

      this.uploadedBackups.set(metadata.id, location);

      logger.info(`✓ Backup uploaded to ${location.url} (${metadata.size} bytes)`);
      return location;
    } catch (error) {
      logger.error(`Failed to upload backup: ${error}`);
      throw error;
    }
  }

  /**
   * Download backup file from S3
   */
  async downloadBackup(backupId: string, outputPath: string): Promise<void> {
    try {
      logger.info(`Downloading backup ${backupId} from S3...`);

      const location = this.uploadedBackups.get(backupId);
      if (!location) {
        throw new Error(`Backup ${backupId} not found in cache. Use listBackups() first.`);
      }

      const params = {
        Bucket: this.bucket,
        Key: location.key
      };

      const data = await this.s3.getObject(params).promise();

      if (!data.Body) {
        throw new Error('Empty response from S3');
      }

      // Save to file
      return new Promise((resolve, reject) => {
        const stream = createWriteStream(outputPath);
        stream.write(data.Body as Buffer);
        stream.end();
        stream.on('finish', () => {
          logger.info(`✓ Backup downloaded to ${outputPath}`);
          resolve();
        });
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to download backup: ${error}`);
      throw error;
    }
  }

  /**
   * List all backups in S3
   */
  async listBackups(backupType?: string): Promise<BackupLocation[]> {
    try {
      logger.info('Listing backups from S3...');

      const params: AWS.S3.ListObjectsV2Request = {
        Bucket: this.bucket,
        Prefix: 'backups/'
      };

      let backups: BackupLocation[] = [];
      let isTruncated = true;

      while (isTruncated) {
        const response = await this.s3.listObjectsV2(params).promise();

        if (response.Contents) {
          for (const obj of response.Contents) {
            if (backupType && !obj.Key?.includes(backupType)) {
              continue;
            }

            backups.push({
              bucket: this.bucket,
              prefix: 'backups/',
              key: obj.Key || '',
              url: `s3://${this.bucket}/${obj.Key}`,
              size: obj.Size || 0,
              lastModified: obj.LastModified || new Date(),
              eTag: obj.ETag || '',
              storageClass: obj.StorageClass || 'STANDARD'
            });
          }
        }

        isTruncated = response.IsTruncated || false;
        if (isTruncated) {
          params.ContinuationToken = response.NextContinuationToken;
        }
      }

      logger.info(`✓ Found ${backups.length} backups`);
      return backups;
    } catch (error) {
      logger.error(`Failed to list backups: ${error}`);
      throw error;
    }
  }

  /**
   * Delete backup from S3
   */
  async deleteBackup(s3Location: string): Promise<void> {
    try {
      logger.info(`Deleting backup from S3: ${s3Location}`);

      const key = s3Location.replace(`s3://${this.bucket}/`, '');

      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key
      }).promise();

      logger.info(`✓ Backup deleted: ${s3Location}`);
    } catch (error) {
      logger.error(`Failed to delete backup: ${error}`);
      throw error;
    }
  }

  /**
   * Get backup header (first 100 bytes) for verification
   */
  async getBackupHeader(s3Location: string, bytes: number = 100): Promise<Buffer> {
    try {
      const key = s3Location.replace(`s3://${this.bucket}/`, '');

      const params = {
        Bucket: this.bucket,
        Key: key,
        Range: `bytes=0-${bytes - 1}`
      };

      const data = await this.s3.getObject(params).promise();

      return data.Body as Buffer;
    } catch (error) {
      logger.error(`Failed to get backup header: ${error}`);
      throw error;
    }
  }

  /**
   * Restore backup metadata from S3 tags
   */
  async getBackupMetadata(s3Location: string): Promise<Record<string, string>> {
    try {
      const key = s3Location.replace(`s3://${this.bucket}/`, '');

      const taggingResponse = await this.s3.getObjectTagging({
        Bucket: this.bucket,
        Key: key
      }).promise();

      const metadata: Record<string, string> = {};
      if (taggingResponse.TagSet) {
        for (const tag of taggingResponse.TagSet) {
          metadata[tag.Key] = tag.Value;
        }
      }

      return metadata;
    } catch (error) {
      logger.error(`Failed to get backup metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Enable S3 versioning (for point-in-time recovery)
   */
  private async enableVersioning(): Promise<void> {
    try {
      logger.info('Enabling S3 versioning...');

      await this.s3.putBucketVersioning({
        Bucket: this.bucket,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }).promise();

      logger.info('✓ Versioning enabled');
    } catch (error) {
      logger.warn('Failed to enable versioning:', error);
    }
  }

  /**
   * Enable encryption for S3 bucket
   */
  private async enableEncryption(): Promise<void> {
    try {
      logger.info('Enabling S3 encryption...');

      const rules: AWS.S3.ServerSideEncryptionConfiguration['Rules'] = [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: this.config.encryptionKey ? 'aws:kms' : 'AES256',
            KMSMasterKeyID: this.config.encryptionKey
          }
        }
      ];

      await this.s3.putBucketEncryption({
        Bucket: this.bucket,
        ServerSideEncryptionConfiguration: { Rules: rules }
      }).promise();

      logger.info('✓ Encryption enabled');
    } catch (error) {
      logger.warn('Failed to enable encryption:', error);
    }
  }

  /**
   * Setup lifecycle policies for cost optimization
   */
  private async setupLifecyclePolicies(): Promise<void> {
    try {
      logger.info('Setting up S3 lifecycle policies...');

      const rules: AWS.S3.LifecycleRule[] = [
        {
          Id: 'TransitionFullBackups',
          Prefix: 'backups/full/',
          Status: 'Enabled',
          Transitions: [
            {
              Days: 7,
              StorageClass: 'STANDARD_IA'  // After 7 days
            },
            {
              Days: 30,
              StorageClass: 'GLACIER'  // After 30 days
            },
            {
              Days: 90,
              StorageClass: 'DEEP_ARCHIVE'  // After 90 days
            }
          ],
          Expiration: {
            Days: 365  // Delete after 1 year
          }
        },
        {
          Id: 'ExpireIncrementalBackups',
          Prefix: 'backups/incremental/',
          Status: 'Enabled',
          Expiration: {
            Days: 7  // Delete after 7 days
          }
        },
        {
          Id: 'ExpireWalLogs',
          Prefix: 'backups/wal/',
          Status: 'Enabled',
          Expiration: {
            Days: 3  // Delete after 3 days
          }
        }
      ];

      await this.s3.putBucketLifecycleConfiguration({
        Bucket: this.bucket,
        LifecycleConfiguration: { Rules: rules }
      }).promise();

      logger.info('✓ Lifecycle policies configured:');
      logger.info('  - Full backups: STANDARD → STANDARD_IA (7d) → GLACIER (30d) → DEEP_ARCHIVE (90d) → DELETE (365d)');
      logger.info('  - Incremental: DELETE (7d)');
      logger.info('  - WAL logs: DELETE (3d)');
    } catch (error) {
      logger.warn('Failed to setup lifecycle policies:', error);
    }
  }

  /**
   * Generate S3 key for backup
   */
  private getS3Key(metadata: BackupMetadata): string {
    const timestamp = metadata.timestamp.toISOString().split('T')[0];  // YYYY-MM-DD
    return `backups/${metadata.type}/${timestamp}/${metadata.id}.sql.gz`;
  }

  /**
   * Get S3 backup statistics
   */
  async getStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    storageBreakdown: Record<string, number>;
  }> {
    try {
      const backups = await this.listBackups();

      const stats = {
        totalBackups: backups.length,
        totalSize: backups.reduce((sum, b) => sum + b.size, 0),
        byType: {} as Record<string, { count: number; size: number }>,
        storageBreakdown: {} as Record<string, number>
      };

      for (const backup of backups) {
        const type = backup.key.split('/')[1];

        if (!stats.byType[type]) {
          stats.byType[type] = { count: 0, size: 0 };
        }

        stats.byType[type].count++;
        stats.byType[type].size += backup.size;

        const storage = backup.storageClass;
        stats.storageBreakdown[storage] = (stats.storageBreakdown[storage] || 0) + backup.size;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get S3 statistics:', error);
      throw error;
    }
  }
}

export default S3BackupStore;
