/**
 * HashDrop HKDF-SHA-256 Module
 *
 * Provides HMAC-based Key Derivation Function (HKDF) using SHA-256.
 * Used to derive key-encryption keys from ML-KEM shared secrets.
 *
 * Construction:
 *   ML-KEM shared secret
 *        │
 *        ▼
 *   HKDF-SHA-256 (extract + expand)
 *        │
 *        ▼
 *   key-encryption key (for wrapping AES content key)
 *
 * Uses Web Crypto API for browser compatibility.
 */

import { utf8ToBytes } from '../encoding';

/**
 * HKDF-SHA-256 extract phase
 * Extracts a pseudo-random key from input keying material
 */
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const crypto = globalThis.crypto;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    ikm.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return baseKey;
}

/**
 * HKDF-SHA-256 expand phase
 * Expands the pseudo-random key to the desired length
 */
async function hkdfExpand(prk: CryptoKey, info: Uint8Array, length: number): Promise<Uint8Array> {
  const crypto = globalThis.crypto;
  const hashLen = 32; // SHA-256 output length
  const n = Math.ceil(length / hashLen);
  
  const okm = new Uint8Array(n * hashLen);
  let t = new Uint8Array(0);
  
  for (let i = 1; i <= n; i++) {
    const data = new Uint8Array(t.length + info.length + 1);
    data.set(t, 0);
    data.set(info, t.length);
    data[data.length - 1] = i;
    
    const signature = await crypto.subtle.sign('HMAC', prk, data.buffer as ArrayBuffer);
    t = new Uint8Array(signature);
    okm.set(t, (i - 1) * hashLen);
  }
  
  return okm.slice(0, length);
}

/**
 * HKDF-SHA-256 full extract-and-expand
 *
 * @param ikm - Input Keying Material (e.g., ML-KEM shared secret)
 * @param salt - Optional salt (defaults to zero-filled)
 * @param info - Optional context/application-specific info
 * @param length - Desired output length in bytes
 * @returns Derived key material
 */
export async function hkdfSha256(
  ikm: Uint8Array,
  salt?: Uint8Array,
  info?: Uint8Array,
  length: number = 32
): Promise<Uint8Array> {
  // Default salt to zero-filled if not provided
  const actualSalt = salt || new Uint8Array(32);
  const actualInfo = info || new Uint8Array(0);
  
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.importKey === 'function') {
    // Web Crypto API path
    const crypto = globalThis.crypto;
    
    // Extract phase
    const prk = await crypto.subtle.importKey(
      'raw',
      actualSalt.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const prkSigned = await crypto.subtle.sign('HMAC', prk, ikm.buffer as ArrayBuffer);
    const prkKey = await crypto.subtle.importKey(
      'raw',
      prkSigned,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Expand phase
    return hkdfExpand(prkKey, actualInfo, length);
  } else {
    // Node.js crypto fallback
    const crypto = require('crypto');
    
    // Extract phase: PRK = HMAC-Hash(salt, IKM)
    const prk = crypto.createHmac('sha256', Buffer.from(actualSalt)).update(Buffer.from(ikm)).digest();
    
    // Expand phase
    const hashLen = 32;
    const n = Math.ceil(length / hashLen);
    const okm = Buffer.alloc(n * hashLen);
    let t = Buffer.alloc(0);
    
    for (let i = 1; i <= n; i++) {
      const hmac = crypto.createHmac('sha256', prk);
      hmac.update(t);
      hmac.update(Buffer.from(actualInfo));
      hmac.update(Buffer.from([i]));
      t = hmac.digest();
      t.copy(okm, (i - 1) * hashLen);
    }
    
    return new Uint8Array(okm.slice(0, length));
  }
}

// HKDF domain separation constants
const HKDF_SALT = utf8ToBytes('HashDrop-Private-HKDF-Salt-v1');
const HKDF_INFO_PREFIX = 'HASHDROP-PRIVATE-KEK|v1|';

/**
 * Derive a key-encryption key from ML-KEM shared secret
 *
 * Uses domain-separated HKDF-SHA-256 with:
 * - Explicit protocol-defined salt
 * - Key fingerprint in info for domain separation
 *
 * @param sharedSecret - ML-KEM shared secret (32 bytes)
 * @param keyFingerprint - ML-KEM public key fingerprint (16 hex chars)
 * @returns 32-byte key-encryption key
 */
export async function deriveKeyEncryptionKey(
  sharedSecret: Uint8Array,
  keyFingerprint: string
): Promise<Uint8Array> {
  const info = utf8ToBytes(HKDF_INFO_PREFIX + keyFingerprint);
  return hkdfSha256(sharedSecret, HKDF_SALT, info, 32);
}
