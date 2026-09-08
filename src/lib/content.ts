/**
 * HashDrop Content Engine
 * Handles byte counting, hashing, content type detection, and HashDrop ID generation
 */

import * as crypto from 'crypto';

export interface ContentMeta {
  bytes: Uint8Array;
  hash: string;
  size: number;
  contentType: string;
  hashDropId: string;
}

/**
 * Supported content types for V1
 */
export const SUPPORTED_CONTENT_TYPES: Record<string, string> = {
  'text/plain': 'Plain Text',
  'text/javascript': 'JavaScript',
  'text/typescript': 'TypeScript',
  'application/json': 'JSON',
  'text/markdown': 'Markdown',
  'text/html': 'HTML',
  'text/css': 'CSS',
};

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
 * Calculate SHA-256 hash of content
 * Uses Node.js crypto in server environment, Web Crypto API in browser
 */
export async function calculateHash(bytes: Uint8Array): Promise<string> {
  // Check if we're in a browser environment with Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const arrayBuffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(bytes);
    
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
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
 * Full content processing - calculates all metadata
 */
export async function processContent(content: string, creator: string): Promise<ContentMeta> {
  const bytes = stringToBytes(content);
  const hash = await calculateHash(bytes);
  const contentType = detectContentType(content);
  const hashDropId = generateHashDropId(hash, creator, bytes.length);

  return {
    bytes,
    hash,
    size: bytes.length,
    contentType,
    hashDropId,
  };
}