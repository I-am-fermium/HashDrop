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
// HD-P2 = AES-256-GCM + ML-KEM-768 + HKDF-SHA-256, content AAD authenticates
//         the object TYPE in addition to the on-chain commitment fields.
export const HASHDROP_PRIVATE_CRYPTO_VERSION = 'HD-P2';

// Canonical SHA-256 commitment on the wire: exactly 64 LOWERCASE hex characters.
// HashDrop emits lowercase hex everywhere (calculateHash), so this is the one
// canonical representation; "same value, different case" must not be a second
// accepted wire form.
const SHA256_HEX_64 = /^[0-9a-f]{64}$/;

// Canonical key fingerprint: exactly 16 LOWERCASE hex characters (8 bytes =
// first half of SHA-256 of the ML-KEM-768 public key).
const FINGERPRINT_HEX_16 = /^[0-9a-f]{16}$/;

/**
 * Parse a canonical non-negative decimal byte size.
 *
 * Protocol rule: a byte size on the wire is exactly `0` or `[1-9][0-9]*` —
 * no sign, no leading zeros, no whitespace, no trailing garbage, and the value
 * must be representable as a JavaScript safe integer (Number.isSafeInteger).
 *
 * Canonicalization rationale: `100` and `0100` denote the same integer but are
 * DIFFERENT protocol byte strings. parseInt() would silently normalize `0100`,
 * `+100`, ` 100 ` and `100abc` — letting several wire forms mean one value.
 * The canonical form is exactly what encode*Payload() emits (JS number →
 * decimal string), so every legitimate memo/artifact passes and every
 * non-canonical or tampered representation is rejected at parse time.
 *
 * @returns the parsed size, or null when the representation is not canonical
 */
export function parseCanonicalByteSize(value: string): number | null {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    return null;
  }
  const size = Number(value);
  if (!Number.isSafeInteger(size)) {
    return null;
  }
  return size;
}

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

  // Validate SHA-256 hash format: exactly 64 canonical lowercase hex characters —
  // the SAME rule the PROOF and PRIVATE decoders enforce (one canonical hash
  // representation across every mode; malformed or uppercase forms are
  // rejected at parse time, not silently reinterpreted).
  if (!SHA256_HEX_64.test(contentHash)) {
    return null;
  }

  // hashDropId is a required, non-empty field.
  if (!hashDropId) {
    return null;
  }

  // Canonical decimal size only (see parseCanonicalByteSize).
  const contentSize = parseCanonicalByteSize(contentSizeStr);
  if (contentSize === null) {
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

// Unified PROOF payload format (one format for every content kind):
//   HASHDROP|v3|PROOF|hashDropId|sha256|contentSize|contentType|filename
// The memo commits ONLY the cryptographic proof — the hash of the exact
// original bytes, the byte length, the validated MIME type, and the sanitized
// filename (artifact reference; '' for text). No byte content is ever stored.
export interface ProofPayload {
  protocol: string;
  version: string;
  mode: HashDropMode;
  hashDropId: string;
  contentHash: string;
  contentSize: number;
  contentType: string; // MIME type (e.g. text/plain, image/png, video/mp4, audio/webm)
  filename: string; // sanitized original filename ('' when none)
}

/**
 * Encode a Proof Mode payload (unified V3 format).
 * Format: HASHDROP|v3|PROOF|<hashDropId>|<sha256>|<contentSize>|<contentType>|<filename>
 *
 * The SAME memo shape is used for TEXT (contentType text/plain, filename '')
 * and media (PHOTO/VIDEO/VOICE). The original bytes are NEVER included — only
 * the commitment plus the validated MIME type and the sanitized filename
 * (which is the artifact reference: the user keeps the original file).
 *
 * @param contentType - validated MIME type (text/plain | image/png | video/mp4 | …)
 * @param filename - sanitized original filename ('' for text; no '|')
 */
export function encodeProofPayload(
  hashDropId: string,
  contentHash: string,
  contentSize: number,
  contentType: string,
  filename: string
): string {
  return `HASHDROP|v3|PROOF|${hashDropId}|${contentHash}|${contentSize}|${contentType}|${filename}`;
}

/**
 * Decode a Proof Mode payload (unified V3 format, 8 fields).
 * Returns null if the payload is not a valid V3 PROOF payload.
 */
export function decodeProofPayload(memo: string): ProofPayload | null {
  const parts = memo.split('|');

  if (parts.length !== 8) {
    return null;
  }

  const [protocol, version, mode, hashDropId, contentHash, contentSizeStr, contentType, filename] = parts;

  if (protocol !== 'HASHDROP' || version !== 'v3' || mode !== 'PROOF') {
    return null;
  }

  // Validate SHA-256 hash format: exactly 64 canonical lowercase hex characters.
  if (!SHA256_HEX_64.test(contentHash)) {
    return null;
  }

  // hashDropId is a required, non-empty field.
  if (!hashDropId) {
    return null;
  }

  // Canonical decimal size only (see parseCanonicalByteSize).
  const contentSize = parseCanonicalByteSize(contentSizeStr);
  if (contentSize === null) {
    return null;
  }

  // contentType is required and must be non-empty.
  if (!contentType || contentType.length === 0) {
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
    filename: filename ?? '',
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
  cryptoVersion: string; // Cryptographic construction version (e.g., "HD-P2")
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

  // hashDropId is a required, non-empty field.
  if (!hashDropId) {
    return null;
  }

  // Validate SHA-256 hash format: exactly 64 canonical lowercase hex characters.
  if (!SHA256_HEX_64.test(contentHash)) {
    return null;
  }

  // Canonical decimal size only (see parseCanonicalByteSize).
  const contentSize = parseCanonicalByteSize(contentSizeStr);
  if (contentSize === null) {
    return null;
  }

  // contentType is a required field (it is bound into the decryption AAD).
  if (!contentType) {
    return null;
  }

  // Strictly pin the crypto construction: HD-P2 is the ONLY accepted Private
  // crypto version. Anything else — older, newer, unknown, whitespace or case
  // variants — is rejected AT PARSE TIME so an unsupported construction can
  // never reach decryption. No negotiation, no compatibility mapping, no
  // trimming: the field must be byte-identical to the canonical constant.
  if (cryptoVersion !== HASHDROP_PRIVATE_CRYPTO_VERSION) {
    return null;
  }

  // Validate key fingerprint: exactly 16 canonical lowercase hex characters.
  if (!FINGERPRINT_HEX_16.test(keyFingerprint)) {
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

  if (mode === 'PROOF' && parts.length === 8) {
    return decodeProofPayload(memo);
  }

  if (mode === 'PRIVATE' && parts.length === 11) {
    return decodePrivatePayload(memo);
  }

  return null;
}
