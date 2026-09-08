/**
 * HashDrop Protocol Module
 *
 * Provides payload encoding/decoding for the HashDrop v3 protocol.
 *
 * Supported modes:
 *   - PUBLIC: content is published on-chain
 *   - PROOF:  only the cryptographic commitment is published
 *   - PRIVATE: encrypted content published on-chain (hybrid AES-256-GCM + ML-KEM-768)
 *
 * The protocol uses the Solana SPL Memo program to store payloads.
 */

// Canonical SPL Memo program ID
export const MEMO_PROGRAM_ID = 'Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH';

// HashDrop wire/protocol version — serialized in every payload as "HASHDROP|v3|…"
export const HASHDROP_PROTOCOL_VERSION = 'v3';

// Private mode cryptographic construction version
// HD-P1 = AES-256-GCM + ML-KEM-768 + HKDF-SHA-256, version 1
export const HASHDROP_PRIVATE_CRYPTO_VERSION = 'HD-P1';

// Supported protocol modes
export type HashDropMode = 'PUBLIC' | 'PROOF' | 'PRIVATE';

// Public payload format: HASHDROP|v3|PUBLIC|hashDropId|sha256|mimeType|contentSize|base64Content
export interface PublicPayload {
  protocol: string;
  version: string;
  mode: HashDropMode;
  hashDropId: string;
  contentHash: string;
  contentType: string;
  contentSize: number;
  content: string; // Base64 encoded content
}

/**
 * Encode a Public Mode payload (V3 format)
 * Format: HASHDROP|v3|PUBLIC|<hashDropId>|<sha256>|<mimeType>|<contentSize>|<base64Content>
 */
export function encodePublicPayload(
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  base64Content: string
): string {
  return `HASHDROP|v3|PUBLIC|${hashDropId}|${contentHash}|${contentType}|${contentSize}|${base64Content}`;
}

/**
 * Decode a Public Mode payload (V3 format only)
 */
export function decodePublicPayload(memo: string): PublicPayload | null {
  const parts = memo.split('|');

  // V3 format: HASHDROP|v3|PUBLIC|hashDropId|contentHash|contentType|contentSize|base64Content
  if (parts.length !== 8) {
    return null;
  }

  const [protocol, version, mode, hashDropId, contentHash, contentType, contentSizeStr, base64Content] = parts;

  if (protocol !== 'HASHDROP' || version !== 'v3' || mode !== 'PUBLIC') {
    return null;
  }

  const contentSize = parseInt(contentSizeStr, 10);
  if (isNaN(contentSize)) {
    return null;
  }

  return {
    protocol,
    version,
    mode,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    content: base64Content,
  };
}

/**
 * Validate Public Mode payload format (V3 only)
 */
export function isValidPublicPayload(memo: string): boolean {
  return decodePublicPayload(memo) !== null;
}

// Proof Mode payload format: HASHDROP|v3|PROOF|hashDropId|sha256|contentSize
export interface ProofPayload {
  protocol: string;
  version: string;
  mode: HashDropMode;
  hashDropId: string;
  contentHash: string;
  contentSize: number;
}

/**
 * Encode a Proof Mode payload (V3 format)
 * Format: HASHDROP|v3|PROOF|<hashDropId>|<sha256>|<contentSize>
 *
 * Only the cryptographic commitment is stored on-chain.
 * The original content is NEVER included.
 */
export function encodeProofPayload(
  hashDropId: string,
  contentHash: string,
  contentSize: number
): string {
  return `HASHDROP|v3|PROOF|${hashDropId}|${contentHash}|${contentSize}`;
}

/**
 * Decode a Proof Mode payload (V3 format only)
 * Returns null if the payload is not a valid V3 PROOF payload.
 */
export function decodeProofPayload(memo: string): ProofPayload | null {
  const parts = memo.split('|');

  // V3 format: HASHDROP|v3|PROOF|hashDropId|contentHash|contentSize
  if (parts.length !== 6) {
    return null;
  }

  const [protocol, version, mode, hashDropId, contentHash, contentSizeStr] = parts;

  if (protocol !== 'HASHDROP' || version !== 'v3' || mode !== 'PROOF') {
    return null;
  }

  // Validate SHA-256 hash format (64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(contentHash)) {
    return null;
  }

  const contentSize = parseInt(contentSizeStr, 10);
  if (isNaN(contentSize) || contentSize < 0) {
    return null;
  }

  return {
    protocol,
    version,
    mode,
    hashDropId,
    contentHash,
    contentSize,
  };
}

/**
 * Validate Proof Mode payload format (V3 only)
 */
export function isValidProofPayload(memo: string): boolean {
  return decodeProofPayload(memo) !== null;
}

// ============================================================================
// PRIVATE MODE (V3)
// ============================================================================
// Private payload format:
// HASHDROP|v3|PRIVATE|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<encryptedKeyIv>|<encryptedKey>
//
// The encrypted content artifact (AES-256-GCM ciphertext + ML-KEM-768 ciphertext + IV)
// is NOT stored on-chain. It remains a user-controlled off-chain artifact.
// This payload contains only:
// - the plaintext commitment (SHA-256 + UTF-8 byte length)
// - encryption metadata (MIME type, crypto version, key fingerprint)
// - the encrypted AES content-key envelope (IV + wrapped key)
//
// Measured size: ~280-byte memo, ~492-byte serialized transaction —
// compatible with the current ~1232-byte Solana transaction packet limit.

export interface PrivatePayload {
  protocol: string;
  version: string;
  mode: HashDropMode;
  hashDropId: string;
  contentHash: string; // SHA-256 of plaintext (hex)
  contentSize: number; // Plaintext UTF-8 byte length
  contentType: string; // MIME type of plaintext
  cryptoVersion: string; // Cryptographic construction version (e.g., "HD-P1")
  keyFingerprint: string; // ML-KEM public key fingerprint (first 8 bytes of SHA-256, hex)
  encryptedKeyIv: string; // IV for encrypted AES key envelope (Base64)
  encryptedKey: string; // Encrypted AES-256 key envelope (Base64)
}

/**
 * Encode a Private Mode payload (V3 format)
 * Format: HASHDROP|v3|PRIVATE|<hashDropId>|<sha256>|<contentSize>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<encryptedKeyIv>|<encryptedKey>
 *
 * The encrypted content artifact is stored off-chain.
 * This payload contains only the on-chain commitment and encrypted key envelope.
 */
export function encodePrivatePayload(
  hashDropId: string,
  contentHash: string,
  contentSize: number,
  contentType: string,
  keyFingerprint: string,
  encryptedKeyIvBase64: string,
  encryptedKeyBase64: string
): string {
  const cryptoVersion = HASHDROP_PRIVATE_CRYPTO_VERSION;
  return `HASHDROP|v3|PRIVATE|${hashDropId}|${contentHash}|${contentSize}|${contentType}|${cryptoVersion}|${keyFingerprint}|${encryptedKeyIvBase64}|${encryptedKeyBase64}`;
}

/**
 * Decode a Private Mode payload (V3 format only)
 * Returns null if the payload is not a valid V3 PRIVATE payload.
 */
export function decodePrivatePayload(memo: string): PrivatePayload | null {
  const parts = memo.split('|');

  // V3 PRIVATE format: HASHDROP|v3|PRIVATE|hashDropId|contentHash|contentSize|contentType|cryptoVersion|keyFingerprint|encryptedKeyIv|encryptedKey
  if (parts.length !== 11) {
    return null;
  }

  const [protocol, version, mode, hashDropId, contentHash, contentSizeStr, contentType, cryptoVersion, keyFingerprint, encryptedKeyIv, encryptedKey] = parts;

  if (protocol !== 'HASHDROP' || version !== 'v3' || mode !== 'PRIVATE') {
    return null;
  }

  // Validate SHA-256 hash format (64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(contentHash)) {
    return null;
  }

  const contentSize = parseInt(contentSizeStr, 10);
  if (isNaN(contentSize) || contentSize < 0) {
    return null;
  }

  // Validate crypto version is non-empty
  if (!cryptoVersion || cryptoVersion.length === 0) {
    return null;
  }

  // Validate key fingerprint (16 hex chars = 8 bytes)
  if (!/^[a-f0-9]{16}$/i.test(keyFingerprint)) {
    return null;
  }

  // Validate encrypted key IV is non-empty Base64
  if (!encryptedKeyIv || encryptedKeyIv.length === 0) {
    return null;
  }

  // Validate encrypted key is non-empty Base64
  if (!encryptedKey || encryptedKey.length === 0) {
    return null;
  }

  return {
    protocol,
    version,
    mode,
    hashDropId,
    contentHash,
    contentSize,
    contentType,
    cryptoVersion,
    keyFingerprint,
    encryptedKeyIv,
    encryptedKey,
  };
}

/**
 * Validate Private Mode payload format (V3 only)
 */
export function isValidPrivatePayload(memo: string): boolean {
  return decodePrivatePayload(memo) !== null;
}

/**
 * Unified V3 decoder that reads the mode discriminator and dispatches
 * to the appropriate decoder. Returns null for unrecognized payloads.
 *
 * Supports V3 modes: PUBLIC, PROOF, and PRIVATE.
 * Rejects any non-V3 payload cleanly.
 */
export function decodeHashDropPayload(memo: string): PublicPayload | ProofPayload | PrivatePayload | null {
  const parts = memo.split('|');

  // Confirm protocol identifier and version first
  if (parts[0] !== 'HASHDROP' || parts[1] !== 'v3') {
    return null;
  }

  const mode = parts[2];

  if (mode === 'PUBLIC' && parts.length === 8) {
    return decodePublicPayload(memo);
  }

  if (mode === 'PROOF' && parts.length === 6) {
    return decodeProofPayload(memo);
  }

  if (mode === 'PRIVATE' && parts.length === 11) {
    return decodePrivatePayload(memo);
  }

  return null;
}
