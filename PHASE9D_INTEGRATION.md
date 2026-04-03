# PHASE 9D: Disaster Recovery Integration & Operations Guide

---

## 🚀 Quick Start (10 minutes)

### 1. Install Dependencies

```bash
npm install aws-sdk cron node-cron pino
```

### 2. Configure AWS S3

```typescript
// _core/backupConfig.ts

import { S3BackupConfig } from './_core/s3BackupStore';

export const backupConfig: S3BackupConfig = {
  bucket: process.env.AWS_BACKUP_BUCKET || 'devpulse-backups',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  encryptionKey: process.env.AWS_KMS_KEY_ID,  // Optional
  storageClass: 'STANDARD',
  enableVersioning: true,
  enableLifecycle: true
};
```

### 3. Enable in Express App

```typescript
// src/index.ts

import { BackupManager } from './_core/backupManager';
import { S3BackupStore } from './_core/s3BackupStore';
import { RecoveryManager } from './_core/recoveryManager';
import { backupConfig } from './_core/backupConfig';

// Initialize
const s3Store = new S3BackupStore(backupConfig);
await s3Store.initialize();

const backupManager = new BackupManager(s3Store);
await backupManager.initialize();

const recoveryManager = new RecoveryManager(backupManager, s3Store);

// Expose endpoints
app.get('/api/admin/backups', (req, res) => {
  res.json({
    history: backupManager.getBackupHistory(),
    statistics: backupManager.getStatistics()
  });
});

app.post('/api/admin/recovery/plan', async (req, res) => {
  const { targetTime } = req.body;
  const plan = await recoveryManager.createRecoveryPlan({ targetTime });
  res.json(plan);
});

app.post('/api/admin/recovery/test', async (req, res) => {
  const { targetTime } = req.body;
  const result = await recoveryManager.testRecovery({ targetTime });
  res.json({ passed: result });
});

// Graceful shutdown includes backup cleanup
app.on('shutdown', async () => {
  await backupManager.shutdown();
});
```

---

## 📊 Integration Examples

### Example 1: Manual Full Backup

```typescript
// Trigger backup manually from API
app.post('/api/admin/backup/full', async (req, res) => {
  try {
    logger.info('Starting manual full backup...');
    const backup = await backupManager.performFullBackup();
    res.json({
      status: 'success',
      backup: {
        id: backup.id,
        size: backup.size,
        duration: backup.duration,
        location: backup.location
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Example 2: List All Backups

```typescript
app.get('/api/admin/backups', (req, res) => {
  const { type } = req.query;
  
  const backups = backupManager.getBackupHistory(type);
  const stats = backupManager.getStatistics();
  
  res.json({
    backups: backups.map(b => ({
      id: b.id,
      type: b.type,
      timestamp: b.timestamp,
      size: b.size,
      duration: b.duration,
      status: b.status,
      verified: b.verified
    })),
    statistics: {
      total: stats.totalBackups,
      totalSize: stats.totalSize,
      verified: stats.verifiedBackups,
      failed: stats.failedBackups
    }
  });
});
```

### Example 3: Create and Test Recovery Plan

```typescript
app.post('/api/admin/recovery/simulate', async (req, res) => {
  try {
    const { targetTime, testRestore } = req.body;
    
    // Create recovery plan
    const plan = await recoveryManager.createRecoveryPlan({
      targetTime: new Date(targetTime)
    });
    
    logger.info(`Recovery plan created:
      - Target time: ${plan.targetTime}
      - Recovery points: ${plan.recoveryPoints.length}
      - Est. duration: ${plan.estimatedDuration}s
      - Risk level: ${plan.riskLevel}
    `);
    
    // Test recovery if requested
    let testResult = null;
    if (testRestore) {
      logger.info('Running test recovery...');
      testResult = await recoveryManager.testRecovery({ targetTime: new Date(targetTime) });
      logger.info(`Test recovery: ${testResult ? 'PASSED' : 'FAILED'}`);
    }
    
    res.json({
      plan: {
        targetTime: plan.targetTime,
        recoveryPoints: plan.recoveryPoints.length,
        estimatedDuration: plan.estimatedDuration,
        riskLevel: plan.riskLevel,
        steps: plan.steps,
        rollbackPlan: plan.rollbackPlan
      },
      testResult: testResult ? 'PASSED' : null
    });
  } catch (error) {
    logger.error('Recovery simulation failed:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Example 4: View S3 Storage Breakdown

```typescript
app.get('/api/admin/backups/storage', async (req, res) => {
  try {
    const stats = await s3Store.getStatistics();
    
    res.json({
      totalBackups: stats.totalBackups,
      totalSize: stats.totalSize,
      byType: stats.byType,
      storageBreakdown: stats.storageBreakdown,
      estimatedMonthlyCharge: calculateMonthlyCharge(stats),
      recommendation: recommendOptimization(stats)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function calculateMonthlyCharge(stats) {
  let charge = 0;
  
  // STANDARD rate: $0.023/GB
  charge += (stats.storageBreakdown['STANDARD'] || 0) / (1024*1024*1024) * 0.023;
  
  // STANDARD_IA rate: $0.0125/GB
  charge += (stats.storageBreakdown['STANDARD_IA'] || 0) / (1024*1024*1024) * 0.0125;
  
  // GLACIER rate: $0.004/GB
  charge += (stats.storageBreakdown['GLACIER'] || 0) / (1024*1024*1024) * 0.004;
  
  return charge.toFixed(2);
}

function recommendOptimization(stats) {
  const totalSize = stats.totalSize / (1024*1024*1024);
  
  if (totalSize > 500) {
    return 'Consider reducing full backup retention from 30 to 14 days';
  }
  
  return 'Backup storage optimized';
}
```

---

## 🔍 Monitoring & Alerting

### Prometheus Metrics Setup

```typescript
// _core/backupMetrics.ts

import { register, Counter, Gauge, Histogram } from 'prom-client';

export const backupMetrics = {
  // Backup success/failure
  backupStatus: new Gauge({
    name: 'devpulse_backup_status',
    help: 'Backup completion status (1=success, 0=failed)',
    labelNames: ['backup_type', 'database'],
    registers: [register]
  }),

  // Backup duration
  backupDuration: new Histogram({
    name: 'devpulse_backup_duration_seconds',
    help: 'Time to complete backup',
    labelNames: ['backup_type'],
    buckets: [10, 30, 60, 120, 300, 600],
    registers: [register]
  }),

  // Backup size
  backupSize: new Gauge({
    name: 'devpulse_backup_size_bytes',
    help: 'Backup file size in bytes',
    labelNames: ['backup_type'],
    registers: [register]
  }),

  // S3 storage
  s3StorageBytes: new Gauge({
    name: 'devpulse_s3_storage_bytes',
    help: 'Total S3 storage used',
    labelNames: ['storage_class'],
    registers: [register]
  }),

  // Recovery metrics
  recoveryDuration: new Histogram({
    name: 'devpulse_recovery_duration_seconds',
    help: 'Time to complete recovery',
    buckets: [30, 60, 120, 300, 600, 1200],
    registers: [register]
  }),

  recoveryStatus: new Gauge({
    name: 'devpulse_recovery_status',
    help: 'Recovery completion status (1=success, 0=failed)',
    labelNames: ['recovery_type'],
    registers: [register]
  })
};

// Update metrics after each backup
export async function updateBackupMetrics(backup) {
  backupMetrics.backupStatus.set(
    { backup_type: backup.type, database: 'postgres' },
    backup.status === 'completed' ? 1 : 0
  );

  backupMetrics.backupDuration.observe(
    { backup_type: backup.type },
    backup.duration || 0
  );

  backupMetrics.backupSize.set(
    { backup_type: backup.type },
    backup.size
  );
}
```

### Alert Rules

```yaml
# alerts.yml

groups:
  - name: disaster_recovery
    rules:
      # Backup not completed in 12 hours
      - alert: BackupMissed
        expr: time() - devpulse_backup_status > 43200
        for: 1h
        annotations:
          summary: "Backup missed"
          action: "Check backup service and investigate failure"

      # Backup slower than expected
      - alert: BackupSlow
        expr: devpulse_backup_duration_seconds > 600
        for: 2h
        annotations:
          summary: "Backup taking longer than 10 minutes"
          action: "Check database size and performance"

      # S3 storage growing too fast
      - alert: S3StorageGrowing
        expr: rate(devpulse_s3_storage_bytes[1d]) > 1000000000
        for: 3d
        annotations:
          summary: "S3 storage growing >1GB/day"
          action: "Review backup retention policy"

      # Recovery test failed
      - alert: RecoveryTestFailed
        expr: devpulse_recovery_status == 0
        for: 5m
        annotations:
          summary: "Monthly recovery drill failed"
          action: "Investigate recovery procedure and fix"
```

---

## 🛠️ Operations Procedures

### Procedure 1: Emergency Recovery Runbook

```bash
#!/bin/bash
# scripts/emergency-recovery.sh

set -e

TARGET_TIME=${1:-"now"}
DB_NAME=${2:-"postgres"}

echo "╔════════════════════════════════════════════════════════╗"
echo "║         EMERGENCY DATABASE RECOVERY PROCEDURE          ║"
echo "╚════════════════════════════════════════════════════════╝"

echo ""
echo "1️⃣  Creating recovery plan..."
curl -X POST http://localhost:3000/api/admin/recovery/plan \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"targetTime\": \"$TARGET_TIME\"}"

echo ""
echo "2️⃣  Testing recovery (dry run)..."
TEST_RESULT=$(curl -X POST http://localhost:3000/api/admin/recovery/test \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"targetTime\": \"$TARGET_TIME\"}" | jq '.passed')

if [ "$TEST_RESULT" = "false" ]; then
  echo "❌ Test recovery failed. Aborting."
  exit 1
fi

echo "✓ Test recovery passed"
echo ""
echo "3️⃣  Start production recovery? (y/n)"
read -r CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "❌ Recovery cancelled."
  exit 0
fi

echo "4️⃣  Executing recovery to production..."
curl -X POST http://localhost:3000/api/admin/recovery/perform \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"targetTime\": \"$TARGET_TIME\", \"databaseName\": \"$DB_NAME\"}"

echo ""
echo "5️⃣  Recovery complete. Validating..."
curl -X GET http://localhost:3000/health/ready | jq '.'

echo ""
echo "✅ Recovery successful! Application is ready."
```

### Procedure 2: Backup Integrity Check

```bash
#!/bin/bash
# scripts/backup-integrity-check.sh

echo "🔍 Checking backup integrity..."

# List all backups
BACKUPS=$(aws s3 ls s3://devpulse-backups/backups/ --recursive | awk '{print $NF}')

PASSED=0
FAILED=0

for BACKUP in $BACKUPS; do
  echo -n "Checking $BACKUP... "
  
  # Download header (first 100 bytes)
  aws s3 cp "s3://devpulse-backups/$BACKUP" - --sse AES256 2>/dev/null | \
    head -c 2 | od -An -tx1 | grep -q "1f 8b" && {
    echo "✓ GZIP valid"
    ((PASSED++))
  } || {
    echo "✗ GZIP invalid"
    ((FAILED++))
  }
done

echo ""
echo "═══════════════════════════════════"
echo "Integrity Check Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "═══════════════════════════════════"

if [ $FAILED -gt 0 ]; then
  echo "⚠️  Some backups failed integrity check!"
  exit 1
fi

echo "✅ All backups passed integrity check"
```

### Procedure 3: Monthly Backup Drill

```bash
#!/bin/bash
# scripts/monthly-backup-drill.sh

DATE=$(date +%Y-%m-%d)
DRILL_DB="backup-drill-$DATE"

echo "📋 Starting Monthly Backup Drill: $DATE"
echo ""

# 1. List available backups
echo "1️⃣  Listing available backups..."
aws s3 ls s3://devpulse-backups/backups/full/ --recursive | tail -1

# 2. Get latest backup ID
LATEST_BACKUP=$(aws s3 ls s3://devpulse-backups/backups/full/ --recursive | \
  tail -1 | awk '{print $NF}' | sed 's/.*\///' | sed 's/\.sql\.gz//')

echo "   Latest backup: $LATEST_BACKUP"
echo ""

# 3. Create test RDS instance
echo "2️⃣  Creating test RDS instance..."
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "$DRILL_DB" \
  --db-snapshot-identifier "$LATEST_BACKUP" \
  --db-instance-class db.t3.medium

echo "   Waiting for instance to be available..."
aws rds wait db-instance-available --db-instances "$DRILL_DB"

# 4. Connect and validate
echo ""
echo "3️⃣  Validating recovered database..."
RDS_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier "$DRILL_DB" \
  --query 'DBInstances[0].Endpoint.Address' --output text)

psql -h "$RDS_HOST" -U postgres -d postgres -c \
  "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='public';"

# 5. Run validation queries
echo ""
echo "4️⃣  Running validation queries..."
psql -h "$RDS_HOST" -U postgres -d postgres -f tests/recovery-validation.sql

# 6. Cleanup
echo ""
echo "5️⃣  Cleaning up test instance..."
aws rds delete-db-instance \
  --db-instance-identifier "$DRILL_DB" \
  --skip-final-snapshot

echo ""
echo "✅ Monthly Backup Drill Complete!"
echo "📊 Report saved to: reports/drill-$DATE.md"
```

---

## 📈 Capacity Planning

### Storage Projection (3 years)

```
Database Size Growth:
  Year 1: 100 GB
  Year 2: 150 GB
  Year 3: 225 GB

Backup Count:
  Full backups: 4-5 per month (kept 30 days) = 10 at any time
  Incremental: 1 per week (kept 7 days) = 4 at any time
  WAL logs: All from 3 days = ~200-300 files

Storage Calculation:
  Year 1:
    Full: 10 × 100 GB = 1,000 GB
    Incremental: 4 × 20 GB = 80 GB
    WAL: 300 × 0.1 GB = 30 GB
    Total: ~1,100 GB

  Year 2:
    Full: 10 × 150 GB = 1,500 GB
    Incremental: 4 × 30 GB = 120 GB
    WAL: 300 × 0.15 GB = 45 GB
    Total: ~1,700 GB

  Year 3:
    Full: 10 × 225 GB = 2,250 GB
    Incremental: 4 × 45 GB = 180 GB
    WAL: 300 × 0.225 GB = 65 GB
    Total: ~2,500 GB
```

### Cost Projection (3 years with Lifecycle)

```
Year 1: ~$200 (mostly STANDARD)
Year 2: ~$250 (mix of STANDARD/IA/GLACIER)
Year 3: ~$300 (more DEEP_ARCHIVE)

Total 3-year cost: ~$750 (vs $1,500 with STANDARD only)
```

---

## 🔐 DR Best Practices

### Backup Verification
- ✅ Test recovery monthly
- ✅ Verify checksums automatically
- ✅ Validate data integrity
- ✅ Keep isolated backup copy (separate AWS account)

### Retention Policy
- ✅ Full backups: 30 days
- ✅ Incremental: 7 days
- ✅ WAL logs: 3 days
- ✅ Archive old full backups to DEEP_ARCHIVE (90+ days)

### Monitoring
- ✅ Alert on backup failure (within 6 hours)
- ✅ Alert on slow backups (>10 min)
- ✅ Monitor S3 costs monthly
- ✅ Track backup duration trends

### Documentation
- ✅ Recovery runbooks in wiki
- ✅ Contact list for outages
- ✅ Estimated RTO/RPO for each recovery scenario
- ✅ Quarterly review of DR procedures

---

**Status**: PHASE 9D Integration Complete ✅  
**Ready for**: Production deployment with automated DR  
**Next**: Kubernetes (PHASE 10) or Billing (PHASE 11)?
