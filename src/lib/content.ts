/**
 * HashDrop Content Engine
 * Handles byte counting, hashing, content type detection, and HashDrop ID generation
 *
 * Text content is handled through the SAME unified artifact model as media
 * (src/lib/artifact.ts): processContent returns an ArtifactMeta whose
 * contentKind is always 'TEXT'.
 */

import * as crypto from 'crypto';
import type { ArtifactMeta } from './artifact';

/**
 * Detect content type based on file extension or content
 */
export function detectContentType(content: string): string {
  // Simple detection based on extension patterns in content
  // Order matters - more specific patterns should come first
  const patterns: [RegExp, string][] = [
    [/^\s*function\s+\w*\s*\(/, 'text/javascript'],
    [/^\s*const\s+\w*\s*=/, 'text/typescript'],
    [/^\s*export\s+\w+/, 'text/typescript'],
    [/^\s*import\s+.*\s+from/, 'text/typescript'],
    [/^\s*<html/i, 'text/html'],
    [/^\s*<\?xml/, 'text/xml'],
    [/^\s*\{.*"[\w]+"\s*:/, 'application/json'], // JSON must come before CSS
    [/\s*\{[\s\S]*:\s*[^}]+;?\s*\}/, 'text/css'], // CSS class with property
    [/^#\s+.*/m, 'text/markdown'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(content)) {
      return type;
    }
  }

  return 'text/plain';
}

/**
 * Calculate SHA-256 hash of the EXACT byte sequence passed in.
 * Uses Web Crypto API in browser environments, Node.js crypto otherwise.
 *
 * The input `Uint8Array` is passed directly to the digest primitive (a
 * typed-array BufferSource), so large media files are NOT additionally copied
 * into a second buffer before hashing.
 */
export async function calculateHash(bytes: Uint8Array): Promise<string> {
  // Check if we're in a browser environment with Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  } else {
    // Use Node.js crypto
    const hash = crypto.createHash('sha256');
    hash.update(bytes);
    return hash.digest('hex');
  }
}

/**
 * Convert string content to bytes (UTF-8 encoding)
 */
export function stringToBytes(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

/**
 * Generate deterministic HashDrop ID from content hash and creator
 */
export function generateHashDropId(hash: string, creator: string, contentSize: number): string {
  // The HashDrop ID is a deterministic identifier
  // Format: "hd" + hash[0:8] + shortened creator + size hash
  const sizeHash = Math.abs(contentSize).toString(36);
  const creatorShort = creator.slice(0, 8);
  return `hd_${hash.slice(0, 8)}_${creatorShort}_${sizeHash}`;
}

/**
 * Full content processing - calculates all artifact metadata for TEXT input.
 * Returns the unified ArtifactMeta (contentKind 'TEXT', filename '').
 */
export async function processContent(content: string, creator: string): Promise<ArtifactMeta> {
  const bytes = stringToBytes(content);
  const hash = await calculateHash(bytes);
  const mimeType = detectContentType(content);
  const hashDropId = generateHashDropId(hash, creator, bytes.length);

  return {
    bytes,
    hash,
    size: bytes.length,
    mimeType,
    contentKind: 'TEXT',
    filename: '',
    hashDropId,
  };
}