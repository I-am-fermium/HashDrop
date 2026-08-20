/**
 * HashDrop Memo Module
 * 
 * Provides memo payload encoding/decoding for Memo Drop publication method
 * This is now the ONLY publication method for HashDrop.
 */

import { utf8ToBase64 } from './encoding';

// Canonical SPL Memo program ID
export const MEMO_PROGRAM_ID = 'Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH';

// Memo payload version
export const MEMO_VERSION = 'v2';

// Transaction size limits
export const LEGACY_TRANSACTION_MAX_BYTES = 1232;
export const V1_TRANSACTION_MAX_BYTES = 4096;

// Memo payload format for V2: HASHDROP|v2|MEMO|hashDropId|sha256|mimeType|length|base64Content
export interface MemoPayload {
  protocol: string;
  version: string;
  type: string;
  hashDropId: string;
  contentHash: string;
  contentType: string;
  contentSize: number;
  content: string; // Base64 encoded content
}

/**
 * Encode content into a memo payload (V2 format)
 * Format: HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
 */
export function encodeMemoPayload(
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  base64Content: string
): string {
  return `HASHDROP|v2|MEMO|${hashDropId}|${contentHash}|${contentType}|${contentSize}|${base64Content}`;
}

/**
 * Decode a memo payload string (V2 format only)
 */
export function decodeMemoPayload(memo: string): MemoPayload | null {
  const parts = memo.split('|');
  
  // V2 format: HASHDROP|v2|MEMO|hashDropId|contentHash|contentType|contentSize|base64Content
  if (parts.length !== 8) {
    return null;
  }
  
  const [protocol, version, type, hashDropId, contentHash, contentType, contentSizeStr, base64Content] = parts;
  
  if (protocol !== 'HASHDROP' || version !== 'v2' || type !== 'MEMO') {
    return null;
  }
  
  const contentSize = parseInt(contentSizeStr, 10);
  if (isNaN(contentSize)) {
    return null;
  }
  
  return {
    protocol,
    version,
    type,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    content: base64Content,
  };
}

/**
 * Validate memo payload format (V2 only)
 */
export function isValidMemoPayload(memo: string): boolean {
  return decodeMemoPayload(memo) !== null;
}

/**
 * Get the memo program public key (as string for serialization)
 */
export function getMemoProgramId(): string {
  return MEMO_PROGRAM_ID;
}

/**
 * Encode string to base64 (handles unicode properly)
 * Uses the centralized UTF-8-safe encoding utility
 */
export function encodeBase64(str: string): string {
  return utf8ToBase64(str);
}

/**
 * Check if content fits within memo size limits for v1 transactions (4096 bytes)
 * @param content - The content to check
 * @returns true if content fits within the transaction limits
 */
export function canFitInMemo(content: string): boolean {
  const bytes = new TextEncoder().encode(content);
  const maxBytes = V1_TRANSACTION_MAX_BYTES;
  
  // Calculate the memo payload size
  const base64Content = encodeBase64(content);
  const hashDropId = 'hd_test';
  const contentHash = '0'.repeat(64);
  const contentType = 'text/plain';
  const contentSize = bytes.length;
  
  const memoPayload = encodeMemoPayload(
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    base64Content
  );
  
  const memoBytes = new TextEncoder().encode(memoPayload).length;
  
  // Transaction overhead for v1 transactions:
  // - Message header: ~4 bytes
  // - Account keys: ~32 bytes each (at least one for fee payer)
  // - Instructions: ~6 bytes + memo length
  // - Signature: ~64 bytes
  // Total overhead: ~176 bytes
  const TRANSACTION_OVERHEAD = 176;
  const totalTransactionSize = memoBytes + TRANSACTION_OVERHEAD;
  
  return totalTransactionSize <= maxBytes;
}

/**
 * Get the maximum content size that can fit in a v1 transaction
 * @returns Maximum content size in bytes
 */
export function getMaxContentSize(): number {
  const TRANSACTION_OVERHEAD = 176;
  return V1_TRANSACTION_MAX_BYTES - TRANSACTION_OVERHEAD;
}

/**
 * Get the maximum size of serialized transaction for a given memo payload
 * This accounts for transaction overhead (signatures, account keys, etc.)
 */
export function getSerializedTransactionSize(memoBytes: number): number {
  // Transaction overhead includes:
  // - Message header: ~4 bytes
  // - Account keys: ~32 bytes each (at least one for fee payer)
  // - Instruction: ~4 bytes + memo length
  // - Signatures: ~64 bytes each
  // 
  // For a memo-only transaction:
  // - 1 account key (fee payer): 32 bytes
  // - Message header: ~4 bytes  
  // - Instructions (memo): ~6 + memoBytes
  // - Signature: ~64 bytes
  // 
  // Approximate overhead: ~112 bytes + 64 bytes signature = ~176 bytes
  const TRANSACTION_OVERHEAD = 176;
  return memoBytes + TRANSACTION_OVERHEAD;
}

/**
 * Validate that a transaction with the given memo will fit within v1 limits (4096 bytes)
 */
export function canSerializeTransaction(memoContent: string): boolean {
  const maxBytes = V1_TRANSACTION_MAX_BYTES;
  const memoBytes = new TextEncoder().encode(memoContent).length;
  const totalSize = getSerializedTransactionSize(memoBytes);
  return totalSize <= maxBytes;
}

/**
 * Calculate the actual transaction size for a given content
 * Returns the total transaction size in bytes
 */
export function calculateTransactionSize(content: string): {
  contentBytes: number;
  memoPayloadBytes: number;
  transactionBytes: number;
  maxTransactionBytes: number;
  availableBytes: number;
} {
  const contentBytes = new TextEncoder().encode(content).length;
  const base64Content = encodeBase64(content);
  const hashDropId = 'hd_test';
  const contentHash = '0'.repeat(64);
  const contentType = 'text/plain';
  
  const memoPayload = encodeMemoPayload(
    hashDropId,
    contentHash,
    contentType,
    contentBytes,
    base64Content
  );
  
  const memoPayloadBytes = new TextEncoder().encode(memoPayload).length;
  // Transaction overhead for v1 transactions: ~176 bytes
  const TRANSACTION_OVERHEAD = 176;
  const transactionBytes = memoPayloadBytes + TRANSACTION_OVERHEAD;
  const maxBytes = V1_TRANSACTION_MAX_BYTES;
  const availableBytes = maxBytes - transactionBytes;
  
  return {
    contentBytes,
    memoPayloadBytes,
    transactionBytes,
    maxTransactionBytes: maxBytes,
    availableBytes,
  };
}
