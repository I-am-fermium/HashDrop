/**
 * HashDrop Client-Side Download Utilities
 *
 * Pure client-side file exports built on Blob + object URLs.
 *
 * Nothing in this module touches the network: downloads never send data to a
 * server, which keeps exported encrypted artifacts and ML-KEM key envelopes
 * entirely user-controlled (off-chain, per the V3 PRIVATE architecture).
 *
 * Exported formats (produced by the existing crypto helpers, unchanged):
 *   - Encrypted artifact : HASHDROP-PRIVATE-BLOB|v1|...  (.hdp file)
 *   - ML-KEM private key : HASHDROP-KEY|v1|ML-KEM-768|... (.txt file)
 *   - ML-KEM public key  : HASHDROP-PUBKEY|v1|ML-KEM-768|... (.txt file)
 */

// MIME types for exports
export const PRIVATE_ARTIFACT_MIME_TYPE = 'application/octet-stream';
export const PRIVATE_KEY_TEXT_MIME_TYPE = 'text/plain';
export const PUBLIC_KEY_TEXT_MIME_TYPE = 'text/plain';

/**
 * Sanitize a dynamic segment used inside a filename.
 * HashDrop IDs and key fingerprints are already filename-safe
 * (base58/hex + underscores), but this keeps exports safe even if the
 * caller passes unexpected characters.
 */
function sanitizeFilenameSegment(segment: string): string {
  return segment.replace(/[^A-Za-z0-9._-]/g, '_');
}

/**
 * Trigger a client-side file download of a text payload.
 *
 * Uses Blob + URL.createObjectURL + a temporary anchor click. No fetch, no
 * server request, no external storage — the file never leaves the user's
 * browser except as a local download.
 *
 * @param filename - Suggested download filename
 * @param content - File content (text)
 * @param mimeType - MIME type for the Blob (default: text/plain)
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string = 'text/plain'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Trigger a client-side file download of binary bytes.
 *
 * Used to save recovered/original media artifacts (proof originals, decrypted
 * private media) and raw byte payloads. Pure client-side Blob download — no
 * fetch, no server request.
 *
 * @param filename - Suggested download filename
 * @param bytes - Raw bytes to save
 * @param mimeType - MIME type for the Blob
 */
export function downloadBytesFile(
  filename: string,
  bytes: Uint8Array,
  mimeType: string = 'application/octet-stream'
): void {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Filename for an encrypted PRIVATE artifact export.
 * e.g. hashdrop-private-hd_ab12cd34_wallet_1t.hdp
 */
export function buildPrivateArtifactFilename(hashDropId: string): string {
  return `hashdrop-private-${sanitizeFilenameSegment(hashDropId)}.hdp`;
}

/**
 * Filename for an ML-KEM-768 private key export.
 * e.g. hashdrop-mlkem-768-private-key-aabbccddeeff0011.txt
 */
export function buildPrivateKeyFilename(keyFingerprint: string): string {
  return `hashdrop-mlkem-768-private-key-${sanitizeFilenameSegment(keyFingerprint)}.txt`;
}

/**
 * Filename for an ML-KEM-768 public key export.
 * e.g. hashdrop-mlkem-768-public-key-aabbccddeeff0011.txt
 */
export function buildPublicKeyFilename(keyFingerprint: string): string {
  return `hashdrop-mlkem-768-public-key-${sanitizeFilenameSegment(keyFingerprint)}.txt`;
}
