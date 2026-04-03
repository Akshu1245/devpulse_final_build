/**
 * AES-GCM Encryption Service
 * =========================
 * Provides encryption and decryption for sensitive data like API keys.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto';
import { ENV } from './env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const key = ENV.ENCRYPTION_MASTER_KEY || ENV.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_MASTER_KEY or ENCRYPTION_KEY environment variable is required');
  }
  
  // If it's a hex string (64 chars for 32 bytes), convert it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  
  // Otherwise, derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

const KEY = getEncryptionKey();

if (KEY.length !== 32) {
  throw new Error('Encryption key must be 32 bytes (256 bits)');
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all hex encoded)
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * Expects format: iv:authTag:ciphertext (all hex encoded)
 */
export function decryptSecret(encryptedStr: string): string {
  const parts = encryptedStr.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format. Expected: iv:authTag:ciphertext');
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error('Invalid encrypted value format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create a SHA-256 hash of a secret for comparison purposes
 * (One-way hash, cannot be reversed)
 */
export function hashSecret(plaintext: string): string {
  const salt = ENV.ENCRYPTION_MASTER_KEY || ENV.ENCRYPTION_KEY || 'dev-salt';
  return crypto.createHash('sha256').update(plaintext + salt).digest('hex');
}

/**
 * Verify a secret against its hash
 */
export function verifySecret(plaintext: string, hash: string): boolean {
  return hashSecret(plaintext) === hash;
}

/**
 * Generate a new API key with prefix
 * Returns the raw key, its hash, and its encrypted form
 */
export function generateApiKey(prefix: string = 'dp'): { key: string; hash: string; encrypted: string } {
  const raw = `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
  return {
    key: raw,
    hash: hashSecret(raw),
    encrypted: encryptSecret(raw),
  };
}

/**
 * Decrypt an API key to its raw form
 */
export function decryptApiKey(encryptedKey: string): string {
  return decryptSecret(encryptedKey);
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate an encryption key suitable for storage
 * (64 hex characters = 32 bytes)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
