# DevPulse Production Secrets Generation Guide
# ==============================================

This document provides the exact commands to generate all required production secrets.

## Quick Generation (Copy-Paste Ready)

### 1. JWT Secret (48 bytes base64)
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64'))"
```

### 2. Encryption Master Key (32 bytes hex)
```bash
node -e "console.log('ENCRYPTION_MASTER_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. MySQL Database Password (32 bytes base64)
```bash
node -e "console.log('DB_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Redis Password (32 bytes base64)
```bash
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
```

### 5. Generate All At Once
```bash
echo "# DevPulse Production Secrets - Generated $(date)"
echo ""
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log('ENCRYPTION_MASTER_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('DB_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
echo ""
echo "# Copy these values to .env.production"
echo "# NEVER commit secrets to version control"
echo "# Store in secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)"
```

## What Each Secret Does

### JWT_SECRET
- **Purpose:** Signs JSON Web Tokens for user authentication
- **Length:** 48 bytes (base64 encoded) = 64 characters
- **Security:** Must be at least 32 bytes for production security
- **Rotation:** Every 90 days recommended

### ENCRYPTION_MASTER_KEY
- **Purpose:** Encrypts sensitive data at rest (API keys, credentials)
- **Length:** 32 bytes (hex encoded) = 64 characters
- **Security:** AES-256 encryption standard
- **Rotation:** Requires re-encryption of existing data; plan carefully

### DB_PASSWORD
- **Purpose:** MySQL database authentication for 'devpulse' user
- **Length:** 32 bytes (base64) = Strong password
- **Security:** Database connections must use SSL/TLS
- **Configuration:** `ALTER USER 'devpulse'@'%' REQUIRE SSL;`

### REDIS_PASSWORD
- **Purpose:** Redis authentication (AUTH command)
- **Length:** 32 bytes (base64) = Strong password
- **Security:** Use TLS (rediss://) in production
- **Configuration:** Set `requirepass <REDIS_PASSWORD>` in redis.conf

## Security Best Practices

1. **Never log secrets** - Ensure secrets don't appear in logs
2. **Use environment variables** - Never hardcode secrets
3. **Separate environments** - Different secrets for dev/staging/prod
4. **Rotate regularly** - Change secrets every 90 days
5. **Access control** - Limit who can view/modify secrets
6. **Secure storage** - Use secret management tools (AWS Secrets Manager, Vault)
7. **Audit access** - Log who accesses secrets and when
8. **Backup encrypted** - Keep encrypted backups of secrets
9. **Revoke compromised** - Immediately rotate if exposed
10. **Monitor usage** - Alert on unusual secret usage patterns

## Post-Generation Checklist

- [ ] Generate all 4 secrets using commands above
- [ ] Copy secrets to .env.production file
- [ ] Verify .env.production is in .gitignore
- [ ] Store backup copy in secure vault (not on filesystem)
- [ ] Configure MySQL to require SSL
- [ ] Configure Redis with requirepass
- [ ] Test database connection with SSL enabled
- [ ] Test Redis connection with AUTH
- [ ] Verify JWT tokens sign/verify correctly
- [ ] Test encryption/decryption with master key
- [ ] Document secret rotation schedule
- [ ] Set calendar reminder for 90-day rotation

## Troubleshooting

### "JWT token invalid"
- Verify JWT_SECRET matches in all service instances
- Check secret length (must be >= 32 bytes)
- Ensure no extra whitespace in .env file

### "Database connection failed"
- Verify DATABASE_URL includes ssl={"rejectUnauthorized":true}
- Check MySQL user has SSL requirement: `SHOW CREATE USER 'devpulse'@'%';`
- Ensure firewall allows port 3306

### "Redis AUTH failed"
- Verify REDIS_URL includes password: `rediss://:PASSWORD@host:6380`
- Check redis.conf has `requirepass` directive
- Ensure Redis is listening on correct port

### "Encryption error"
- Verify ENCRYPTION_MASTER_KEY is exactly 64 hex characters
- Check key hasn't been truncated or modified
- Ensure no special characters or line breaks

## Emergency Secret Rotation

If secrets are compromised:

1. **Immediate:**
   - Generate new secrets using commands above
   - Update .env.production on all servers
   - Restart all service instances

2. **For JWT_SECRET:**
   - All existing user sessions will be invalidated
   - Users must re-authenticate
   - Update all service instances simultaneously

3. **For ENCRYPTION_MASTER_KEY:**
   - Requires re-encrypting all encrypted data
   - Plan downtime window
   - Run migration script to re-encrypt with new key

4. **For DB_PASSWORD:**
   - Update MySQL user password
   - Update DATABASE_URL in .env.production
   - Restart services

5. **For REDIS_PASSWORD:**
   - Update redis.conf requirepass
   - Restart Redis
   - Update REDIS_URL in .env.production
   - Restart services

---

**Last Updated:** 2026-04-03  
**Maintainer:** DevPulse Security Team
