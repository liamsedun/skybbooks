/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

/**
 * Retrieves the encryption key, falling back to a dummy key in development
 * to prevent startup crashes.
 */
function getEncryptionKey(): Buffer {
  let keyString = process.env.ENCRYPTION_KEY;
  
  if (!keyString) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('WARNING: ENCRYPTION_KEY environment variable is not defined. Using a insecure placeholder key for development.');
      keyString = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 32-byte hex string
    } else {
      throw new Error('ENCRYPTION_KEY environment variable is required in production.');
    }
  }

  try {
    const key = Buffer.from(keyString, 'hex');
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters).');
    }
    return key;
  } catch (error) {
    throw new Error(`Failed to parse ENCRYPTION_KEY: ${(error as Error).message}`);
  }
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format is `ivHex:ciphertextHex:authTagHex`.
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended IV size for GCM is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypts a AES-256-GCM encrypted string.
 * Input format must be `ivHex:ciphertextHex:authTagHex`.
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted input format. Must be formatted as ivHex:ciphertextHex:authTagHex.');
  }

  const [ivHex, ciphertextHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
