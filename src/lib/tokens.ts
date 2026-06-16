/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

export interface TokenPayload {
  userId: string;
  orgId: string | null;
  role: string;
  email: string;
}

let privateKeyCache: string | null = null;
let publicKeyCache: string | null = null;

/**
 * Retrieves the cryptographic keys for RS256 token signing and verification.
 * Automatically generates a 2048-bit RSA keypair in-memory during development
 * if they are not supplied via environment variables.
 */
function getKeys(): { privateKey: string; publicKey: string } {
  const envPrivate = process.env.JWT_PRIVATE_KEY;
  const envPublic = process.env.JWT_PUBLIC_KEY;

  if (envPrivate && envPublic) {
    const privateKey = envPrivate.replace(/\\n/g, '\n');
    const publicKey = envPublic.replace(/\\n/g, '\n');
    return { privateKey, publicKey };
  }

  if (privateKeyCache && publicKeyCache) {
    return { privateKey: privateKeyCache, publicKey: publicKeyCache };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('WARNING: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are not defined. Generating a 2048-bit RSA key pair in memory for development.');

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    });

    privateKeyCache = privateKey;
    publicKeyCache = publicKey;
    return { privateKey, publicKey };
  } else {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables are required in production.');
  }
}

/**
 * Generates an Access Token valid for 15 minutes.
 */
export function generateAccessToken(payload: TokenPayload): string {
  const { privateKey } = getKeys();
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: '15m'
  };
  return jwt.sign(payload, privateKey, options);
}

/**
 * Generates a Refresh Token valid for 7 days.
 */
export function generateRefreshToken(payload: TokenPayload): string {
  const { privateKey } = getKeys();
  const options: SignOptions = {
    algorithm: 'RS256',
    expiresIn: '7d'
  };
  return jwt.sign(payload, privateKey, options);
}

/**
 * Verifies and decodes an Access Token. Throws an error if invalid/expired.
 */
export function verifyAccessToken(token: string): TokenPayload {
  const { publicKey } = getKeys();
  const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
  return decoded as TokenPayload;
}

/**
 * Verifies and decodes a Refresh Token. Throws an error if invalid/expired.
 */
export function verifyRefreshToken(token: string): TokenPayload {
  const { publicKey } = getKeys();
  const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
  return decoded as TokenPayload;
}

/**
 * Hashes a token using SHA-256 (useful for securely saving refresh tokens in a database).
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
