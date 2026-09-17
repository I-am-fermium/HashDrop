/**
 * HashDrop Private Drop Encryption Module
 *
 * Orchestrates hybrid encryption for V3 PRIVATE mode:
 * - AES-256-GCM for content encryption (symmetric)
 * - ML-KEM-768 for protecting the AES key (post-quantum KEM)
 * - HKDF-SHA-256 for deriving key-encryption key from ML-KEM shared secret
 *
 * Construction:
 *   plaintext
 *      │
 *      ├── SHA-256 → plaintext hash (on-chain commitment)
 *      │
 *      └── random AES-256 key (independently generated)
 *             │
 *             ├───────────────┐
 *             │               │
 *             ▼               ▼
 *        AES-256-GCM      ML-KEM-768
 *             │               │
 *             ▼               ▼
 *        ciphertext      ML-KEM shared secret
 *        (in artifact)        │
 *                             ▼
 *                        HKDF-SHA-256
 *                             │
 *                             ▼
 *                        key-encryption key (KEK)
 *                             │
 *                             ▼
 *                        AES-256-GCM wrap
 *                             │
 *                             ▼
 *                        encrypted AES-key envelope
 *                        (on-chain)
 *
 * Key lifecycle:
 * 1. Generate random AES-256 content key (independently random)
 * 2. Generate random 96-bit IV (never reused)
 * 3. Encrypt content with AES-256-GCM → encrypted artifact
 * 4. Encapsulate with ML-KEM-768 public key → shared secret
 * 5. Derive KEK via HKDF-SHA-256 from shared secret
 * 6. Wrap random AES key with KEK → encrypted key envelope
 * 7. Store on-chain: commitment + encrypted key envelope
 * 8. Store off-chain: encrypted artifact
 *
 * Decryption:
 * 1. Decapsulate ML-KEM ciphertext with secret key → shared secret
 * 2. Derive KEK via HKDF-SHA-256 from shared secret
 * 3. Unwrap encrypted AES key with KEK → random AES content key
 * 4. Decrypt AES-GCM ciphertext with AES key → plaintext
 * 5. Verify plaintext hash and byte length
 */

import { generateAesKey, generateAesIv, aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';
import { encapsulate, decapsulate, MlKemKeypair } from './mlKem';
import { wrapAesKey, unwrapAesKey, AesKeyEnvelope } from './keyWrapper';
import { deriveKeyEncryptionKey } from './hkdf';
import { createArtifact, EncryptedArtifact } from './encryptedArtifact';
import { utf8ToBytes } from '../encoding';

// AAD construction constants
const KEY_ENVELOPE_AAD_PREFIX = 'HASHDROP-PRIVATE-KEY|v1|';
const CONTENT_AAD_PREFIX = 'HASHDROP-PRIVATE-BLOB|v1|';

// Crypto version for PRIVATE mode (must match src/lib/memo.ts)
const HASHDROP_PRIVATE_CRYPTO_VERSION = 'HD-P2';

/**
 * Construct canonical key-envelope AAD from immutable on-chain metadata.
 * The object TYPE is authenticated alongside the commitment fields so that a
 * tampered type/MIME combination is detected at AES-GCM authentication time.
 * Format: HASHDROP-PRIVATE-KEY|v1|<hashDropId>|<sha256>|<contentSize>|<objectType>|<mimeType>|<cryptoVersion>|<keyFingerprint>
 */
function constructKeyEnvelopeAAD(params: {
  hashDropId: string;
  contentHash: string;
  contentSize: number;
  objectType: string;
  contentType: string;
  cryptoVersion: string;
  keyFingerprint: string;
}): Uint8Array {
  const aad = `${KEY_ENVELOPE_AAD_PREFIX}${params.hashDropId}|${params.contentHash}|${params.contentSize}|${params.objectType}|${params.contentType}|${params.cryptoVersion}|${params.keyFingerprint}`;
  return utf8ToBytes(aad);
}

/**
 * Construct canonical content-artifact AAD from immutable on-chain metadata.
 * Format: HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<objectType>|<mimeType>|<cryptoVersion>|<keyFingerprint>
 */
function constructContentAAD(params: {
  hashDropId: string;
  contentHash: string;
  contentSize: number;
  objectType: string;
  contentType: string;
  cryptoVersion: string;
  keyFingerprint: string;
}): Uint8Array {
  const aad = `${CONTENT_AAD_PREFIX}${params.hashDropId}|${params.contentHash}|${params.contentSize}|${params.objectType}|${params.contentType}|${params.cryptoVersion}|${params.keyFingerprint}`;
  return utf8ToBytes(aad);
}

/**
 * Derive the canonical artifact object type from a validated MIME type.
 * The object type is a deterministic function of the MIME type, so it can be
 * reconstructed exactly during decryption without being stored on-chain.
 * @throws Error when the MIME type is not a supported HashDrop type
 */
export function objectTypeFromMime(contentType: string): string {
  const { classifyMimeType } = require('../media');
  const kind = classifyMimeType(contentType);
  if (!kind) {
    throw new Error(`Unsupported artifact MIME type: ${contentType ?? 'unknown'}`);
  }
  return kind;
}

/**
 * Private drop encryption result
 */
export interface PrivateEncryptionResult {
  hashDropId: string; // HashDrop ID (for AAD binding)
  plaintextHash: string; // SHA-256 of original plaintext (hex)
  plaintextSize: number; // Original byte length
  contentType: string; // MIME type of original content
  encryptedArtifact: EncryptedArtifact; // IV + ciphertext (off-chain)
  encryptedKeyEnvelope: AesKeyEnvelope; // Encrypted AES key (on-chain)
  keyFingerprint: string; // Fingerprint of ML-KEM public key (on-chain)
  mlKemCiphertext: Uint8Array; // ML-KEM ciphertext (needed for decryption)
  filename: string; // sanitized original filename ('' when none; artifact only)
}

/**
 * Private drop decryption request
 */
export interface PrivateDecryptionRequest {
  hashDropId: string; // HashDrop ID (for AAD binding and verification)
  encryptedArtifact: EncryptedArtifact;
  encryptedKeyEnvelope: AesKeyEnvelope;
  mlKemCiphertext: Uint8Array; // ML-KEM ciphertext (from artifact)
  mlKemSecretKey: Uint8Array; // Recipient's secret key
  keyFingerprint: string; // ML-KEM public key fingerprint (used as HKDF info)
  expectedHash: string; // Expected SHA-256 of plaintext (hex)
  expectedSize: number; // Expected UTF-8 byte length
  contentType: string; // Expected MIME type (for AAD and verification)
}

/**
 * Private drop decryption result
 */
export interface PrivateDecryptionResult {
  plaintext: Uint8Array;
  hash: string;
  size: number;
  verified: boolean;
}

/**
 * Encrypt content for a private drop
 *
 * Exact construction:
 * 1. Generate random AES-256 content key
 * 2. Generate random 96-bit IV
 * 3. Encrypt plaintext with AES-256-GCM → encrypted artifact
 * 4. Encapsulate with ML-KEM-768 public key → shared secret
 * 5. Derive KEK via HKDF-SHA-256 from shared secret
 * 6. Wrap random AES key with KEK using AES-256-GCM → encrypted key envelope
 *
 * @param plaintext - Original content bytes
 * @param plaintextHash - SHA-256 hash of plaintext (hex)
 * @param contentType - MIME type
 * @param recipientPublicKey - ML-KEM-768 recipient public key
 * @param keyFingerprint - Fingerprint of recipient public key
 * @param hashDropId - Authenticated HashDrop identifier
 * @param filename - Optional original filename (stored only in the
 *                   off-chain artifact envelope, never in the on-chain memo
 *                   and never in the AAD; defaults to '')
 * @returns Encryption result containing artifact and key envelope
 */
export async function encryptPrivateContent(
  plaintext: Uint8Array,
  plaintextHash: string,
  contentType: string,
  recipientPublicKey: Uint8Array,
  keyFingerprint: string,
  hashDropId: string,
  filename?: string
): Promise<PrivateEncryptionResult> {
  // Step 1: Generate random AES-256 content key (independently random)
  const aesContentKey = generateAesKey();

  // Step 2: Generate a random 96-bit IV for content encryption. The key-envelope
  // IV is generated independently inside wrapAesKey (fresh, never reused, never
  // shared with the content IV).
  const contentIv = generateAesIv();

  // Step 3: Encapsulate with ML-KEM-768 public key
  const { ciphertext: mlKemCiphertext, sharedSecret } = await encapsulate(recipientPublicKey);

  // Step 4: Derive KEK via HKDF-SHA-256 from shared secret
  const kek = await deriveKeyEncryptionKey(sharedSecret, keyFingerprint);

  // Step 5: Construct AAD bindings (object type is authenticated with the
  // commitment fields, so a tampered type/MIME is rejected at GCM time)
  const objectType = objectTypeFromMime(contentType);

  const contentAad = constructContentAAD({
    hashDropId,
    contentHash: plaintextHash,
    contentSize: plaintext.length,
    objectType,
    contentType,
    cryptoVersion: HASHDROP_PRIVATE_CRYPTO_VERSION,
    keyFingerprint,
  });

  const keyEnvelopeAad = constructKeyEnvelopeAAD({
    hashDropId,
    contentHash: plaintextHash,
    contentSize: plaintext.length,
    objectType,
    contentType,
    cryptoVersion: HASHDROP_PRIVATE_CRYPTO_VERSION,
    keyFingerprint,
  });

  // Step 6: Encrypt content with AES-256-GCM (with AAD)
  const ciphertext = await aesGcmEncrypt(plaintext, aesContentKey, contentIv, contentAad);

  // Create the encrypted artifact with ML-KEM ciphertext and metadata
  const encryptedArtifact = createArtifact(
    {
      hashDropId,
      contentHash: plaintextHash,
      contentSize: plaintext.length,
      type: objectType as 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO',
      contentType,
      keyFingerprint,
      filename,
    },
    mlKemCiphertext,
    contentIv,
    ciphertext
  );

  // Step 7: Wrap random AES content key with KEK (with AAD)
  const encryptedKeyEnvelope = await wrapAesKey(aesContentKey, kek, keyEnvelopeAad);

  return {
    hashDropId,
    plaintextHash,
    plaintextSize: plaintext.length,
    contentType,
    encryptedArtifact,
    encryptedKeyEnvelope,
    keyFingerprint,
    mlKemCiphertext,
    filename: filename || '',
  };
}

/**
 * Decrypt content from a private drop
 *
 * Exact construction:
 * 1. Decapsulate ML-KEM ciphertext with secret key → shared secret
 * 2. Derive KEK via HKDF-SHA-256 from shared secret
 * 3. Unwrap encrypted AES key with KEK → random AES content key
 * 4. Decrypt AES-GCM ciphertext with AES key → plaintext
 * 5. Verify plaintext hash and byte length
 *
 * @param request - Decryption request containing artifact, key envelope, and secret key
 * @returns Decryption result with plaintext and verification status
 */
export async function decryptPrivateContent(
  request: PrivateDecryptionRequest
): Promise<PrivateDecryptionResult> {
  // Step 1: Decapsulate ML-KEM ciphertext with secret key → shared secret
  const sharedSecret = await decapsulate(request.mlKemCiphertext, request.mlKemSecretKey);

  // Step 2: Derive KEK via HKDF-SHA-256 from shared secret
  const kek = await deriveKeyEncryptionKey(sharedSecret, request.keyFingerprint);

  // Step 3: Reconstruct AAD bindings (must match encryption exactly).
  // The object type is a deterministic function of the on-chain MIME type, so
  // it is reconstructed rather than stored on-chain.
  const objectType = objectTypeFromMime(request.contentType);

  // Defense in depth: the artifact's own type field must not contradict the
  // reconstructed type (the artifact→memo binding is checked by the verifier).
  if (request.encryptedArtifact.type && request.encryptedArtifact.type !== objectType) {
    throw new Error('Artifact type does not match the on-chain MIME type.');
  }

  const keyEnvelopeAad = constructKeyEnvelopeAAD({
    hashDropId: request.hashDropId,
    contentHash: request.expectedHash,
    contentSize: request.expectedSize,
    objectType,
    contentType: request.contentType,
    cryptoVersion: HASHDROP_PRIVATE_CRYPTO_VERSION,
    keyFingerprint: request.keyFingerprint,
  });

  const contentAad = constructContentAAD({
    hashDropId: request.hashDropId,
    contentHash: request.expectedHash,
    contentSize: request.expectedSize,
    objectType,
    contentType: request.contentType,
    cryptoVersion: HASHDROP_PRIVATE_CRYPTO_VERSION,
    keyFingerprint: request.keyFingerprint,
  });

  // Step 4: Unwrap encrypted AES key with KEK → random AES content key
  let aesContentKey: Uint8Array;
  try {
    aesContentKey = await unwrapAesKey(request.encryptedKeyEnvelope, kek, keyEnvelopeAad);
  } catch (e) {
    throw new Error('Key unwrapping failed: invalid key or tampered envelope');
  }

  // Step 5: Decrypt AES-GCM ciphertext with AES key → plaintext
  let plaintext: Uint8Array;
  try {
    plaintext = await aesGcmDecrypt(
      request.encryptedArtifact.ciphertext,
      aesContentKey,
      request.encryptedArtifact.iv,
      contentAad
    );
  } catch (e) {
    throw new Error('Decryption failed: invalid key or tampered ciphertext');
  }

  // Step 6: Verify plaintext size
  if (plaintext.length !== request.expectedSize) {
    throw new Error(`Size verification failed: expected ${request.expectedSize}, got ${plaintext.length}`);
  }

  // Step 7: Verify plaintext hash
  const { calculateHash } = require('../content');
  const calculatedHash = await calculateHash(plaintext);
  if (calculatedHash !== request.expectedHash) {
    throw new Error('Hash verification failed: decrypted content does not match on-chain commitment');
  }

  return {
    plaintext,
    hash: calculatedHash,
    size: plaintext.length,
    verified: true,
  };
}

/**
 * Generate a new ML-KEM-768 keypair for a recipient
 * @returns ML-KEM-768 keypair
 */
export async function generateRecipientKeypair(): Promise<MlKemKeypair> {
  const { generateKeypair } = require('./mlKem');
  return generateKeypair();
}
