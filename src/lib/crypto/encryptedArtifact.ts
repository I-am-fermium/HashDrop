/**
 * HashDrop Encrypted Artifact Module
 *
 * Defines the portable encrypted artifact format for PRIVATE mode.
 *
 * The artifact contains everything needed to decrypt the content
 * EXCEPT the ML-KEM secret key.
 *
 * Artifact format (versioned envelope):
 *   HASHDROP-PRIVATE-BLOB|v1|<base64-mlkem-ct>|<base64-iv>|<base64-ciphertext>
 *
 * This format is:
 *   - Human-readable (starts with HASHDROP-PRIVATE-BLOB)
 *   - Versioned (v1)
 *   - Self-describing (contains ML-KEM ct, IV, and ciphertext)
 *   - Portable (can be saved to file, transferred between devices)
 *
 * IMPORTANT: The artifact does NOT contain the secret key.
 * The user must provide the secret key separately to decrypt.
 */

import { bytesToBase64, base64ToBytes } from '../encoding';

// Artifact envelope constants
const ARTIFACT_PREFIX = 'HASHDROP-PRIVATE-BLOB';
const ARTIFACT_VERSION = 'v1';

/**
 * Encrypted artifact structure
 */
export interface EncryptedArtifact {
  hashDropId: string; // HashDrop ID (for binding verification)
  contentHash: string; // SHA-256 of plaintext (for binding verification)
  contentSize: number; // Plaintext UTF-8 byte length (for binding verification)
  contentType: string; // MIME type (for binding verification)
  keyFingerprint: string; // ML-KEM public key fingerprint (for binding verification)
  mlKemCiphertext: Uint8Array; // ML-KEM-768 ciphertext (1088 bytes)
  iv: Uint8Array; // AES-GCM 96-bit nonce
  ciphertext: Uint8Array; // AES-256-GCM encrypted content (includes auth tag)
}

/**
 * Create an encrypted artifact
 *
 * @param metadata - HashDrop metadata for binding verification
 * @param mlKemCiphertext - ML-KEM-768 ciphertext (1088 bytes)
 * @param iv - AES-GCM 96-bit nonce
 * @param ciphertext - AES-256-GCM encrypted content
 * @returns Encrypted artifact
 */
export function createArtifact(
  metadata: {
    hashDropId: string;
    contentHash: string;
    contentSize: number;
    contentType: string;
    keyFingerprint: string;
  },
  mlKemCiphertext: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): EncryptedArtifact {
  return {
    hashDropId: metadata.hashDropId,
    contentHash: metadata.contentHash,
    contentSize: metadata.contentSize,
    contentType: metadata.contentType,
    keyFingerprint: metadata.keyFingerprint,
    mlKemCiphertext,
    iv,
    ciphertext,
  };
}

/**
 * Export artifact as a versioned envelope string
 *
 * Format: HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<base64-mlkem-ct>|<base64-iv>|<base64-ciphertext>
 *
 * @param artifact - Encrypted artifact
 * @returns Versioned envelope string
 */
export function exportArtifact(artifact: EncryptedArtifact): string {
  const base64MlKemCt = bytesToBase64(artifact.mlKemCiphertext);
  const base64Iv = bytesToBase64(artifact.iv);
  const base64Ciphertext = bytesToBase64(artifact.ciphertext);
  return `${ARTIFACT_PREFIX}|${ARTIFACT_VERSION}|${artifact.hashDropId}|${artifact.contentHash}|${artifact.contentSize}|${artifact.contentType}|HD-P1|${artifact.keyFingerprint}|${base64MlKemCt}|${base64Iv}|${base64Ciphertext}`;
}

/**
 * Import artifact from a versioned envelope string
 *
 * @param envelope - Versioned envelope string
 * @returns Encrypted artifact
 * @throws Error if envelope is invalid or corrupted
 */
export function importArtifact(envelope: string): EncryptedArtifact {
  const parts = envelope.split('|');
  
  if (parts.length !== 11) {
    throw new Error('Invalid artifact envelope format: expected 11 parts');
  }
  
  const [prefix, version, hashDropId, contentHash, contentSizeStr, contentType, cryptoVersion, keyFingerprint, base64MlKemCt, base64Iv, base64Ciphertext] = parts;
  
  if (prefix !== ARTIFACT_PREFIX) {
    throw new Error(`Invalid artifact envelope prefix: expected ${ARTIFACT_PREFIX}, got ${prefix}`);
  }
  
  if (version !== ARTIFACT_VERSION) {
    throw new Error(`Unsupported artifact envelope version: ${version}`);
  }
  
  const contentSize = parseInt(contentSizeStr, 10);
  if (isNaN(contentSize) || contentSize < 0) {
    throw new Error('Invalid content size');
  }
  
  const mlKemCiphertext = base64ToBytes(base64MlKemCt);
  const iv = base64ToBytes(base64Iv);
  const ciphertext = base64ToBytes(base64Ciphertext);
  
  if (mlKemCiphertext.length !== 1088) {
    throw new Error(`Invalid ML-KEM ciphertext length: expected 1088, got ${mlKemCiphertext.length}`);
  }
  
  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12, got ${iv.length}`);
  }
  
  if (ciphertext.length < 16) {
    throw new Error(`Invalid ciphertext length: must be at least 16 bytes (GCM tag)`);
  }
  
  return {
    hashDropId,
    contentHash,
    contentSize,
    contentType,
    keyFingerprint,
    mlKemCiphertext,
    iv,
    ciphertext,
  };
}

/**
 * Validate artifact structure without full decoding
 *
 * @param envelope - Versioned envelope string
 * @returns True if valid format
 */
export function isValidArtifact(envelope: string): boolean {
  try {
    importArtifact(envelope);
    return true;
  } catch {
    return false;
  }
}
