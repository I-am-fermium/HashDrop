/**
 * HashDrop ML-KEM Key Manager
 *
 * Provides key generation, export, import, and fingerprinting for ML-KEM-768 keys.
 *
 * Key lifecycle:
 *   1. Generate keypair
 *   2. Export secret key (for backup/transfer)
 *   3. Export public key (for sharing with encryptors)
 *   4. Import secret key (for decryption on another device)
 *   5. Calculate key fingerprint (for on-chain identification)
 *
 * Key export format (versioned envelope):
 *   HASHDROP-KEY|v1|ML-KEM-768|<base64-encoded-key>
 *
 * This format is:
 *   - Human-readable (starts with HASHDROP-KEY)
 *   - Versioned (v1)
 *   - Algorithm-identified (ML-KEM-768)
 *   - Deterministic and compact (Base64)
 *
 * IMPORTANT: Secret keys must be kept secret.
 * Never store in URLs, logs, or on-chain.
 */

import { ML_KEM_768_PUBLIC_KEY_BYTES, ML_KEM_768_SECRET_KEY_BYTES } from './mlKem';
import { bytesToBase64, base64ToBytes } from '../encoding';
import { calculateHash } from '../content';

// Key envelope constants
const KEY_ENVELOPE_PREFIX = 'HASHDROP-KEY';
const KEY_ENVELOPE_VERSION = 'v1';
const KEY_ALGORITHM = 'ML-KEM-768';

/**
 * Export secret key as a versioned envelope string
 *
 * Format: HASHDROP-KEY|v1|ML-KEM-768|<base64-encoded-secret-key>
 *
 * @param secretKey - ML-KEM-768 secret key (2400 bytes)
 * @returns Versioned envelope string
 */
export function exportSecretKey(secretKey: Uint8Array): string {
  const base64Key = bytesToBase64(secretKey);
  return `${KEY_ENVELOPE_PREFIX}|${KEY_ENVELOPE_VERSION}|${KEY_ALGORITHM}|${base64Key}`;
}

/**
 * Import secret key from a versioned envelope string
 *
 * @param envelope - Versioned envelope string
 * @returns ML-KEM-768 secret key (2400 bytes)
 * @throws Error if envelope is invalid or corrupted
 */
export function importSecretKey(envelope: string): Uint8Array {
  const parts = envelope.split('|');
  
  if (parts.length !== 4) {
    throw new Error('Invalid key envelope format: expected 4 parts');
  }
  
  const [prefix, version, algorithm, base64Key] = parts;
  
  if (prefix !== KEY_ENVELOPE_PREFIX) {
    throw new Error(`Invalid key envelope prefix: expected ${KEY_ENVELOPE_PREFIX}, got ${prefix}`);
  }
  
  if (version !== KEY_ENVELOPE_VERSION) {
    throw new Error(`Unsupported key envelope version: ${version}`);
  }
  
  if (algorithm !== KEY_ALGORITHM) {
    throw new Error(`Unsupported key algorithm: ${algorithm}`);
  }
  
  const keyBytes = base64ToBytes(base64Key);
  
  if (keyBytes.length !== ML_KEM_768_SECRET_KEY_BYTES) {
    throw new Error(`Invalid secret key length: expected ${ML_KEM_768_SECRET_KEY_BYTES}, got ${keyBytes.length}`);
  }
  
  return keyBytes;
}

/**
 * Export public key as a versioned envelope string
 *
 * Format: HASHDROP-PUBKEY|v1|ML-KEM-768|<base64-encoded-public-key>
 *
 * @param publicKey - ML-KEM-768 public key (1184 bytes)
 * @returns Versioned envelope string
 */
export function exportPublicKey(publicKey: Uint8Array): string {
  const base64Key = bytesToBase64(publicKey);
  return `HASHDROP-PUBKEY|${KEY_ENVELOPE_VERSION}|${KEY_ALGORITHM}|${base64Key}`;
}

/**
 * Import public key from a versioned envelope string
 *
 * @param envelope - Versioned envelope string
 * @returns ML-KEM-768 public key (1184 bytes)
 * @throws Error if envelope is invalid or corrupted
 */
export function importPublicKey(envelope: string): Uint8Array {
  const parts = envelope.split('|');
  
  if (parts.length !== 4) {
    throw new Error('Invalid public key envelope format: expected 4 parts');
  }
  
  const [prefix, version, algorithm, base64Key] = parts;
  
  if (prefix !== 'HASHDROP-PUBKEY') {
    throw new Error(`Invalid public key envelope prefix: expected HASHDROP-PUBKEY, got ${prefix}`);
  }
  
  if (version !== KEY_ENVELOPE_VERSION) {
    throw new Error(`Unsupported public key envelope version: ${version}`);
  }
  
  if (algorithm !== KEY_ALGORITHM) {
    throw new Error(`Unsupported public key algorithm: ${algorithm}`);
  }
  
  const keyBytes = base64ToBytes(base64Key);
  
  if (keyBytes.length !== ML_KEM_768_PUBLIC_KEY_BYTES) {
    throw new Error(`Invalid public key length: expected ${ML_KEM_768_PUBLIC_KEY_BYTES}, got ${keyBytes.length}`);
  }
  
  return keyBytes;
}

/**
 * Calculate key fingerprint from public key
 *
 * Fingerprint = first 8 bytes of SHA-256(publicKey)
 * This is NOT secret and can be stored on-chain.
 *
 * @param publicKey - ML-KEM-768 public key
 * @returns 8-byte fingerprint as hex string (16 hex chars)
 */
export async function calculateKeyFingerprint(publicKey: Uint8Array): Promise<string> {
  const hash = await calculateHash(publicKey);
  return hash.slice(0, 16); // First 8 bytes = 16 hex chars
}

/**
 * Validate that a secret key corresponds to a public key
 *
 * @param secretKey - ML-KEM-768 secret key
 * @param publicKey - ML-KEM-768 public key
 * @returns True if keys match
 */
export async function validateKeyPair(secretKey: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
  // Generate a test keypair and check if the public keys match
  // This is a simple validation - in production, you might want to use ML-KEM's own validation
  const { encapsulate, decapsulate } = require('./mlKem');
  
  try {
    // encapsulate() returns { ciphertext, sharedSecret } — destructure the object
    // (the previous array destructuring threw on a non-iterable object and made
    // this helper always return false).
    const { ciphertext, sharedSecret: ss1 } = await encapsulate(publicKey);
    const ss2 = await decapsulate(ciphertext, secretKey);
    return Buffer.from(ss1).equals(Buffer.from(ss2));
  } catch {
    return false;
  }
}
