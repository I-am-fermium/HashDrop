/**
 * HashDrop Unified Artifact Model
 *
 * Every HashDrop payload — text, image, video, audio/voice — is modeled as a
 * single artifact:
 *
 *   ArtifactMeta = artifact metadata + exact bytes
 *
 *   - bytes       : the EXACT original bytes (authoritative for SHA-256)
 *   - hash        : SHA-256 of those exact bytes
 *   - size        : exact byte length
 *   - mimeType    : validated MIME type (never trusted from the client)
 *   - contentKind : TEXT | IMAGE | VIDEO | AUDIO
 *   - filename    : sanitized original filename ('' when none)
 *   - hashDropId  : deterministic HashDrop ID
 *
 * There is deliberately no separate "text artifact" vs "media artifact".
 * TEXT is just a content kind of the same artifact (mime text/plain / ...).
 * The mode (PUBLIC / PROOF / PRIVATE) decides what happens to the artifact —
 * it is not part of the artifact itself.
 *
 * This module has no runtime dependencies, so both the content engine and the
 * media module can import it without a cycle.
 */

/**
 * Logical content kinds. A single artifact can be any of these.
 */
export type ContentKind = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';

/**
 * Canonical artifact metadata: everything needed to reconstruct, encrypt,
 * serialize and verify an object, plus the exact original bytes.
 */
export interface ArtifactMeta {
  bytes: Uint8Array; // exact original bytes (authoritative for SHA-256)
  hash: string; // SHA-256 hex of the exact original bytes
  size: number; // exact byte length
  mimeType: string; // validated MIME type
  contentKind: ContentKind; // TEXT | IMAGE | VIDEO | AUDIO
  filename: string; // sanitized filename; '' when none
  hashDropId: string; // deterministic HashDrop ID
}