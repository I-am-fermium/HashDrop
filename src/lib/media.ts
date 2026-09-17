/**
 * HashDrop Media Content Module
 *
 * Validates and preprocesses PHOTO / VIDEO / VOICE (AUDIO) objects into the
 * unified HashDrop artifact model (src/lib/artifact.ts) for PROOF and PRIVATE
 * modes. PUBLIC mode remains TEXT-only.
 *
 * The artifact abstraction retains the exact information required to
 * reconstruct and verify an object:
 *   contentKind | mimeType | filename | size | sha256
 *
 * Media handling is built strictly on the existing HashDrop primitives:
 *   - SHA-256 hashing  : src/lib/content.ts (calculateHash) — reuse
 *   - HashDrop ID      : src/lib/content.ts (generateHashDropId) — reuse
 *   - Encryption       : src/lib/crypto/privateDrop.ts (AES-256-GCM +
 *                        ML-KEM-768 + HKDF-SHA-256 key hierarchy) — reuse
 *
 * Critical rules implemented here:
 *   - The SHA-256 proof hash is always computed over the EXACT original bytes.
 *   - MIME types are validated against file signatures / magic bytes, never
 *     trusted from the client or the filename extension alone.
 *   - Large media is never placed inside a Solana memo.
 */

import { calculateHash, generateHashDropId } from './content';
import type { ArtifactMeta, ContentKind } from './artifact';

// Re-export the unified artifact types through this module so existing
// callers access them from one place.
export type { ArtifactMeta, ContentKind } from './artifact';

/**
 * Configurable upload size cap (bytes). Browser hashing/encryption operates on
 * the full file bytes in memory (Web Crypto SHA-256/AES-GCM are whole-buffer
 * APIs), so a cap lets us fail cleanly instead of exhausting memory. Videos
 * and long voice recordings above this cap are rejected with a clear error.
 */
export const MAX_MEDIA_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

// ---------------------------------------------------------------- supported
// MIME sets. These are the only types accepted for media uploads. A magic-byte
// signature is required for every binary type; pure-text MIMEs have no magic
// signature but must be explicit text types.
const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'text/typescript',
  'text/xml',
  'application/json',
]);

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
]);

/** Human-readable supported-type summary used in error messages. */
export const SUPPORTED_MEDIA_SUMMARY =
  'images (JPEG/PNG/WebP/GIF), video (MP4/WebM/QuickTime), audio (WebM/OGG/WAV/MP3/MP4)';

/**
 * Classify a MIME type into a logical content kind.
 * Returns null for unsupported/unrecognized MIME types.
 */
export function classifyMimeType(mime: string): ContentKind | null {
  if (!mime) return null;
  const normalized = mime.trim().toLowerCase();
  if (TEXT_MIME_TYPES.has(normalized)) return 'TEXT';
  if (IMAGE_MIME_TYPES.has(normalized)) return 'IMAGE';
  if (VIDEO_MIME_TYPES.has(normalized)) return 'VIDEO';
  if (AUDIO_MIME_TYPES.has(normalized)) return 'AUDIO';
  return null;
}

/** True when the MIME type is in the HashDrop supported set. */
export function isSupportedMime(mime: string): boolean {
  return classifyMimeType(mime) !== null;
}

/** True when the MIME type is one of the media (non-text) kinds. */
export function isMediaMime(mime: string): boolean {
  const kind = classifyMimeType(mime);
  return kind === 'IMAGE' || kind === 'VIDEO' || kind === 'AUDIO';
}

/**
 * Sanitize a filename for use inside the `|`-separated HashDrop descriptor.
 *
 * Rules:
 *   - The memo/artifact protocol uses '|' as its field separator — any '|' and
 *     control characters are replaced.
 *   - Filenames are metadata for display/download naming only; they must never
 *     be treated as filesystem paths. Path separators ('/', '\', ':') are
 *     neutralized and '.'-only / '..' traversal components are collapsed so a
 *     hostile name such as '../../secret.txt' can never become a path.
 *   - The length is capped to keep the on-chain memo compact.
 */
export function sanitizeFilename(filename: string): string {
  let name = String(filename ?? 'file').trim();
  // Neutralize protocol separators, path separators, drive colon, controls.
  name = name.replace(/[|/\\:\u0000-\u001f\u007f]/g, '_');
  // Collapse dot-dot / dot components into a harmless single underscore.
  name = name.replace(/\.\.+/g, '_');
  name = name.replace(/^\.+/, '');
  if (name.length > 120) {
    name = name.slice(0, 120);
  }
  return name || 'file';
}
/** Read 4 ASCII bytes as a string (used for magic-byte comparisons). */
function ascii4(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0, bytes[offset + 3] ?? 0);
}

/** Read 3 ASCII bytes as a string (used for magic-byte comparisons). */
function ascii3(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0);
}

/**
 * Detect the MIME type of a byte sequence from its signature / magic bytes.
 * Returns null when no known signature is detected. Signature detection is
 * authoritative for binary types and never trusts the filename extension.
 */
export function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 4) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: "GIF8"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (bytes.length >= 12 && ascii4(bytes, 0) === 'RIFF' && ascii4(bytes, 8) === 'WEBP') {
    return 'image/webp';
  }

  // OGG container: "OggS"
  if (ascii4(bytes, 0) === 'OggS') {
    return 'audio/ogg';
  }

  // WAV: RIFF....WAVE
  if (bytes.length >= 12 && ascii4(bytes, 0) === 'RIFF' && ascii4(bytes, 8) === 'WAVE') {
    return 'audio/wav';
  }

  // WebM / Matroska (EBML): 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video/webm';
  }

  // MP4 family (ISOBMFF): ....ftyp<brand>
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = ascii4(bytes, 8);
    return brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  }

  // MP3 with ID3 tag
  if (ascii3(bytes, 0) === 'ID3') {
    return 'audio/mpeg';
  }

  // MP3 without ID3 — MPEG audio frame sync (11 bits set, valid version/layer)
  if (
    bytes[0] === 0xff &&
    (bytes[1] & 0xe0) === 0xe0 &&
    (bytes[1] & 0x18) !== 0x08 &&
    (bytes[1] & 0x06) !== 0
  ) {
    return 'audio/mpeg';
  }

  return null;
}
/**
 * Resolve the trusted MIME type for a byte sequence.
 *
 * Rules:
 *   - If a magic-byte signature is detected it is authoritative for binary
 *     content, except where the signature is ambiguous with an equivalent
 *     declared container (WebM audio/video, MP4 audio/video — same container,
 *     different declared subtype), in which case the declared type is kept.
 *   - If a signature and the declared type disagree, the file is REJECTED
 *     (null) so a client cannot publish arbitrary bytes under a spoofed MIME.
 *   - Text content has no magic signature; it is accepted only when the
 *     declared type is an explicit supported text MIME.
 *
 * @returns the trusted MIME type, or null when the file/declared type is
 *          unsupported or mismatched.
 */
export function resolveTrustedMime(bytes: Uint8Array, declared: string): string | null {
  const declaredType = String(declared ?? '').trim().toLowerCase();
  const declaredKind = classifyMimeType(declaredType);

  if (!declaredKind) {
    return null; // unknown/unsupported declared type
  }

  const detected = detectMimeFromMagicBytes(bytes);

  if (!detected) {
    // No recognizable signature. Text has no signature; accept only explicit
    // text types. Binary content without a signature is rejected.
    return declaredKind === 'TEXT' ? declaredType : null;
  }

  const detectedKind = classifyMimeType(detected);
  if (detectedKind === declaredKind) {
    return detected; // use the most accurate signature-derived type
  }

  // Same container, different declared subtype — keep the declared subtype:
  const containerCompatible =
    (detected === 'video/webm' && (declaredType === 'audio/webm' || declaredType === 'video/webm')) ||
    (detected === 'video/mp4' && (declaredType === 'audio/mp4' || declaredType === 'video/mp4')) ||
    (detected === 'video/quicktime' && declaredType === 'video/quicktime');

  if (containerCompatible) {
    return declaredType;
  }

  return null; // signature disagrees with declared type — reject
}
/**
 * Human-readable file size formatter (B/KB/MB/GB).
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
/**
 * Process an uploaded media object end-to-end into the unified artifact model.
 *
 * Pipeline (media):
 *   Original Media -> Raw Bytes -> SHA-256 -> validated MIME -> ArtifactMeta
 *
 * The returned `hash` is SHA-256 of the EXACT original bytes. No preview,
 * transcoded copy, compressed representation, or Base64/JSON wrapper is ever
 * hashed.
 *
 * @throws Error with a safe, descriptive message when the file is empty,
 *         exceeds MAX_MEDIA_FILE_BYTES, or fails MIME validation.
 */
export async function processMediaBytes(
  bytes: Uint8Array,
  filename: string,
  declaredMime: string,
  creator: string
): Promise<ArtifactMeta> {
  if (!bytes || bytes.length === 0) {
    throw new Error('The selected file is empty.');
  }
  if (bytes.length > MAX_MEDIA_FILE_BYTES) {
    throw new Error(
      `File size ${formatFileSize(bytes.length)} exceeds the ${formatFileSize(MAX_MEDIA_FILE_BYTES)} maximum upload limit.`
    );
  }

  const mimeType = resolveTrustedMime(bytes, declaredMime);
  if (!mimeType) {
    throw new Error(
      `Unsupported or unrecognized file type (${declaredMime || 'unknown'}). Supported media input: ${SUPPORTED_MEDIA_SUMMARY}.`
    );
  }

  const contentKind = classifyMimeType(mimeType) as ContentKind;
  const safeFilename = sanitizeFilename(filename);

  // SHA-256 of the exact original bytes — the authoritative proof input.
  const hash = await calculateHash(bytes);

  const hashDropId = generateHashDropId(hash, creator || 'pending', bytes.length);

  return {
    bytes,
    hash,
    size: bytes.length,
    mimeType,
    contentKind,
    filename: safeFilename,
    hashDropId,
  };
}