/**
 * HashDrop Encrypted Artifact Module
 *
 * Defines the ONE canonical encrypted artifact protocol for PRIVATE mode.
 *
 * The artifact contains everything needed to decrypt the content
 * EXCEPT the ML-KEM secret key.
 *
 * Canonical artifact format (single schema version; every content kind uses
 * the same envelope):
 *
 *   HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<objectType>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<base64-mlkem-ct>|<base64-iv>|<base64-ciphertext>|<filename>
 *
 * Version vs. type:
 *   - version ("v1")  = the artifact schema/protocol version (exactly one).
 *   - objectType      = what the encrypted payload represents: TEXT | IMAGE |
 *                       VIDEO | AUDIO. It must be consistent with the MIME
 *                       type inside the same envelope.
 *
 * This format is:
 *   - Human-readable (starts with HASHDROP-PRIVATE-BLOB)
 *   - Versioned (v1)
 *   - Self-describing (contains ML-KEM ct, IV, ciphertext, and artifact metadata)
 *   - Portable (can be saved to file, transferred between devices)
 *   - Content-agnostic (text, image, video, audio all use the same envelope)
 *
 * IMPORTANT: The artifact does NOT contain the secret key.
 * The user must provide the secret key separately to decrypt.
 */

import { bytesToBase64, base64ToBytes } from '../encoding';
import { classifyMimeType, sanitizeFilename } from '../media';
import { HASHDROP_PRIVATE_CRYPTO_VERSION, parseCanonicalByteSize } from '../memo';

// Canonical artifact envelope constants — exactly one schema version.
export const ARTIFACT_PREFIX = 'HASHDROP-PRIVATE-BLOB';
export const ARTIFACT_VERSION = 'v1';
// Fixed field count of the canonical envelope (prefix + 12 fields).
const ARTIFACT_FIELD_COUNT = 13;

/** Supported object types carried by the artifact (parallels ContentKind). */
export const ARTIFACT_TYPES = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'] as const;
export type ArtifactObjectType = (typeof ARTIFACT_TYPES)[number];

/**
 * Encrypted artifact structure
 */
export interface EncryptedArtifact {
  hashDropId: string; // HashDrop ID (for binding verification)
  contentHash: string; // SHA-256 of plaintext (for binding verification)
  contentSize: number; // Plaintext byte length (for binding verification)
  type: ArtifactObjectType; // object type (TEXT | IMAGE | VIDEO | AUDIO)
  contentType: string; // MIME type (for binding verification)
  keyFingerprint: string; // ML-KEM public key fingerprint (for binding verification)
  mlKemCiphertext: Uint8Array; // ML-KEM-768 ciphertext (1088 bytes)
  iv: Uint8Array; // AES-GCM 96-bit nonce
  ciphertext: Uint8Array; // AES-256-GCM encrypted content (includes auth tag)
  filename: string; // sanitized original filename; '' when none (auxiliary display metadata)
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
    type: ArtifactObjectType;
    contentType: string;
    keyFingerprint: string;
    filename?: string;
  },
  mlKemCiphertext: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): EncryptedArtifact {
  const validated = assertArtifactMetadata(metadata.type, metadata.contentType);
  return {
    hashDropId: metadata.hashDropId,
    contentHash: metadata.contentHash,
    contentSize: metadata.contentSize,
    type: validated.type,
    contentType: validated.contentType,
    keyFingerprint: metadata.keyFingerprint,
    mlKemCiphertext,
    iv,
    ciphertext,
    // Enforce the serialization boundary AT CREATION: the filename must never
    // be able to break the pipe-delimited artifact format. It remains display
    // metadata only — intentionally NOT authenticated (not in AAD/hash).
    filename: metadata.filename && metadata.filename.trim()
      ? sanitizeFilename(metadata.filename)
      : '',
  };
}

/**
 * Validate that an object type is supported and consistent with its MIME type.
 * @returns normalized values
 * @throws Error describing the invalid metadata (no secret material exposed)
 */
export function assertArtifactMetadata(
  type: string,
  contentType: string
): { type: ArtifactObjectType; contentType: string } {
  // Canonical wire representation: EXACTLY TEXT | IMAGE | VIDEO | AUDIO.
  // No case folding, no trimming: 'text', 'Text', 'TEXT ' are rejected so the
  // parser accepts exactly one representation per type — the same policy as
  // the HD-P2 crypto-version pin. HashDrop only ever emits uppercase types.
  if (typeof type !== 'string' || !(ARTIFACT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`Unsupported artifact type: ${type ?? 'unknown'}`);
  }

  // Canonical MIME representation: lowercase and unpadded. HashDrop emits
  // lowercase MIME (resolveTrustedMime); the parser must NOT silently
  // normalize 'TEXT/PLAIN' or ' text/plain ' into the canonical form.
  const mime = String(contentType ?? '');
  if (mime !== mime.trim() || mime !== mime.toLowerCase()) {
    throw new Error(`Non-canonical artifact MIME type: ${mime || 'unknown'}`);
  }
  const kind = classifyMimeType(mime);
  if (!kind) {
    throw new Error(`Unsupported artifact MIME type: ${contentType ?? 'unknown'}`);
  }
  if ((ARTIFACT_TYPES as readonly string[]).indexOf(type) !== ARTIFACT_TYPES.indexOf(kind)) {
    throw new Error(
      `Artifact type (${type}) does not match the MIME type (${mime}).`
    );
  }
  return { type: type as ArtifactObjectType, contentType: mime };
}
/**
 * Export artifact as the single canonical versioned envelope string.
 *
 *   HASHDROP-PRIVATE-BLOB|v1|<hashDropId>|<sha256>|<contentSize>|<objectType>|<mimeType>|<cryptoVersion>|<keyFingerprint>|<base64-mlkem-ct>|<base64-iv>|<base64-ciphertext>|<filename>
 *
 * The filename is auxiliary display metadata (downloaded-file naming / UI) and
 * is NOT part of the AAD binding. The AAD authenticates hashDropId|sha256|
 * contentSize|objectType|mimeType|cryptoVersion|keyFingerprint — including the
 * object type — so tampering with `type` is detected at authentication time.
 *
 * @param artifact - Encrypted artifact
 * @returns Versioned envelope string
 */
export function exportArtifact(artifact: EncryptedArtifact): string {
  const base64MlKemCt = bytesToBase64(artifact.mlKemCiphertext);
  const base64Iv = bytesToBase64(artifact.iv);
  const base64Ciphertext = bytesToBase64(artifact.ciphertext);
  return `${ARTIFACT_PREFIX}|${ARTIFACT_VERSION}|${artifact.hashDropId}|${artifact.contentHash}|${artifact.contentSize}|${artifact.type}|${artifact.contentType}|${HASHDROP_PRIVATE_CRYPTO_VERSION}|${artifact.keyFingerprint}|${base64MlKemCt}|${base64Iv}|${base64Ciphertext}|${artifact.filename}`;
}

/**
 * Import artifact from the canonical versioned envelope string.
 * Validates schema version, object type, MIME-type consistency, field types,
 * and cryptographic metadata lengths. Malformed artifacts are rejected with a
 * safe error — never silently reinterpreted.
 *
 * @param envelope - Versioned envelope string
 * @returns Encrypted artifact
 * @throws Error if envelope is invalid or corrupted
 */
export function importArtifact(envelope: string): EncryptedArtifact {
  const parts = envelope.split('|');

  if (parts.length !== ARTIFACT_FIELD_COUNT) {
    throw new Error(`Invalid artifact envelope format: expected ${ARTIFACT_FIELD_COUNT} parts`);
  }

  const [prefix, version, hashDropId, contentHash, contentSizeStr, type, contentType, cryptoVersion, keyFingerprint, base64MlKemCt, base64Iv, base64Ciphertext, filename] = parts;

  if (prefix !== ARTIFACT_PREFIX) {
    throw new Error(`Invalid artifact envelope prefix: expected ${ARTIFACT_PREFIX}, got ${prefix}`);
  }

  if (version !== ARTIFACT_VERSION) {
    throw new Error(`Unsupported artifact version: ${version}`);
  }

  if (cryptoVersion !== HASHDROP_PRIVATE_CRYPTO_VERSION) {
    throw new Error(`Unsupported artifact crypto version: ${cryptoVersion}`);
  }

  // Required identifiers, validated BEFORE any Base64/crypto work:
  // the HashDrop ID must be present, and the SHA-256 commitment / key
  // fingerprint must be exactly 64 / 16 canonical lowercase hex characters —
  // the same rule the on-chain memo decoder enforces (parse → validate →
  // only then decrypt).
  if (!hashDropId) {
    throw new Error('Invalid artifact envelope: missing HashDrop ID');
  }

  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new Error('Invalid artifact content hash: expected 64 lowercase hexadecimal characters');
  }

  if (!/^[0-9a-f]{16}$/.test(keyFingerprint)) {
    throw new Error('Invalid artifact key fingerprint: expected 16 lowercase hexadecimal characters');
  }

  // Canonical decimal size only (see parseCanonicalByteSize in ../memo).
  const contentSize = parseCanonicalByteSize(contentSizeStr);
  if (contentSize === null) {
    throw new Error('Invalid content size');
  }

  // Centralized type/MIME validation (unsupported type, unknown MIME, or a
  // type/MIME mismatch are all rejected here).
  const validated = assertArtifactMetadata(type, contentType);

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
    type: validated.type,
    contentType: validated.contentType,
    keyFingerprint,
    mlKemCiphertext,
    iv,
    ciphertext,
    // The filename is display metadata only; re-sanitize at import so an
    // untrusted envelope can never carry a path-traversal name into the UI.
    filename: filename && filename.trim() ? sanitizeFilename(filename) : '',
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