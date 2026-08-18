/**
 * HashDrop Transaction Builder
 * 
 * Provides transaction construction for Memo Drop.
 * Supports v0 transaction format (current SDK support).
 * Uses network-authoritative pricing from Solana RPC.
 * 
 * v1 Transaction Support:
 * - Only builds real V1 transactions when SDK provides compileToV1Message()
 * - No silent fallback from V1 to V0
 * - Throws clear error if V1 is requested but not supported
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import { ContentMeta } from './content';
import { encodeMemoPayload, getMemoProgramId, MEMO_PROGRAM_ID } from './memo';
import { getConnection } from './solana/networkCost';
import {
  detectTransactionCapabilities as _detectTransactionCapabilities,
  SolanaTransactionCapabilities,
  TransactionVersionType,
  LEGACY_TRANSACTION_MAX_BYTES,
  V1_TRANSACTION_MAX_BYTES,
} from './solana/transactionCapabilities';

// Re-export for use by other modules
export { _detectTransactionCapabilities as detectTransactionCapabilities };

// Transaction size limits
export const LEGACY_TRANSACTION_MAX_BYTES_CONST = 1232;
export const V1_TRANSACTION_MAX_BYTES_CONST = 4096;

/**
 * Build a Memo Drop transaction
 * Creates a transaction with a memo instruction containing the HashDrop payload
 * Uses v0 format (VersionedTransaction with MessageV0)
 */
export async function buildMemoDropTransaction(
  content: string,
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  publicKey: PublicKey,
  connection?: Connection
): Promise<Transaction | VersionedTransaction> {
  const conn = connection || getConnection();
  
  // Detect transaction capabilities
  const capabilities = await _detectTransactionCapabilities(conn);
  console.log('[HashDrop] Transaction capabilities:', capabilities);
  
  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  
  // Encode content as base64 for V2 format
  const base64Content = btoa(content);
  
  // Encode memo payload
  const memoPayload = encodeMemoPayload(
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    base64Content
  );
  
  // Add memo instruction using TransactionInstruction
  const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);
  const memoInstruction = new TransactionInstruction({
    programId: memoProgramId,
    data: Buffer.from(memoPayload, 'utf-8'),
    keys: [],
  });
  
  // Build transaction based on version support
  if (capabilities.supportsV1) {
    // Build v1 transaction (SDK supports it)
    const transaction = buildV1Transaction(
      memoInstruction,
      publicKey,
      blockhash,
      lastValidBlockHeight
    );
    
    console.log('[HashDrop] Built v1 transaction');
    return transaction;
  } else {
    // Build v0 transaction (current SDK support)
    const transaction = buildV0Transaction(
      memoInstruction,
      publicKey,
      blockhash,
      lastValidBlockHeight
    );
    
    console.log('[HashDrop] Built v0 transaction');
    return transaction;
  }
}

/**
 * Build a v0 transaction using VersionedTransaction
 * This is the current maximum supported by the SDK
 */
function buildV0Transaction(
  memoInstruction: TransactionInstruction,
  feePayer: PublicKey,
  blockhash: string,
  lastValidBlockHeight: number
): VersionedTransaction {
  // Create a TransactionMessage
  const transactionMessage = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [memoInstruction],
  });
  
  // Compile to v0 message
  const v0Message = transactionMessage.compileToV0Message();
  
  // Create VersionedTransaction with v0 version
  const versionedTransaction = new VersionedTransaction(v0Message);
  
  return versionedTransaction;
}

/**
 * Build a v1 transaction using VersionedTransaction
 * 
 * REQUIRES: SDK must provide compileToV1Message() method
 * Throws error if SDK does not support v1 transactions.
 * 
 * When the SDK adds v1 support, this function will use:
 *   const v1Message = transactionMessage.compileToV1Message();
 *   const versionedTransaction = new VersionedTransaction(v1Message);
 */
function buildV1Transaction(
  memoInstruction: TransactionInstruction,
  feePayer: PublicKey,
  blockhash: string,
  lastValidBlockHeight: number
): VersionedTransaction {
  // Create a TransactionMessage
  const transactionMessage = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [memoInstruction],
  });
  
  // Check if SDK supports v1 (compileToV1Message exists)
  // This check is required - no silent fallback
  const compileToV1Message = (transactionMessage as any).compileToV1Message;
  
  if (typeof compileToV1Message !== 'function') {
    throw new Error(
      'V1 transactions are not supported by the current Solana SDK. ' +
      'Please upgrade @solana/web3.js to a version that supports compileToV1Message().'
    );
  }
  
  // Build v1 message using the official SDK API
  const v1Message = compileToV1Message.call(transactionMessage);
  const versionedTransaction = new VersionedTransaction(v1Message);
  
  return versionedTransaction;
}

/**
 * Serialize transaction for sending
 * Handles both legacy and v0 transactions
 */
export function serializeTransaction(
  transaction: Transaction | VersionedTransaction
): Buffer {
  if (transaction instanceof VersionedTransaction) {
    return Buffer.from(transaction.serialize());
  }
  return transaction.serialize();
}

/**
 * Deserialize transaction from buffer
 * Handles legacy and v0 transactions
 * Note: V1 deserialization is not supported by current SDK
 */
export function deserializeTransaction(buffer: Buffer): Transaction | VersionedTransaction {
  // Check if this is a v1 transaction by looking at the first byte
  // v1 transactions start with 0x01, legacy with 0x00, v0 with 0x80 (1 << 7)
  const versionByte = buffer[0];
  
  if (versionByte === 0x01) {
    // This is a v1 transaction - current SDK cannot deserialize it
    throw new Error(
      'V1 transaction deserialization is not supported by the current Solana SDK. ' +
      'Please upgrade @solana/web3.js to a version that supports V1 transactions.'
    );
  }
  
  // This is a legacy or v0 transaction
  return VersionedTransaction.deserialize(new Uint8Array(buffer));
}

/**
 * Get the serialized transaction size
 */
export function getTransactionSize(
  transaction: Transaction | VersionedTransaction
): number {
  if (transaction instanceof VersionedTransaction) {
    return transaction.serialize().length;
  }
  return transaction.serialize().length;
}

/**
 * Check if a transaction is a v1 transaction
 * Note: Current SDK only supports v0, so this will return false
 */
export function isV1Transaction(
  transaction: Transaction | VersionedTransaction
): boolean {
  if (transaction instanceof VersionedTransaction) {
    // Check the message version
    // v0 has version 0, legacy has version 'legacy'
    // v1 would have version 1, but current SDK doesn't support it
    const version = transaction.message.version as any;
    return version === 1 || version === '1';
  }
  return false;
}

/**
 * Get transaction version as string
 */
export function getTransactionVersion(
  transaction: Transaction | VersionedTransaction
): TransactionVersionType {
  if (transaction instanceof VersionedTransaction) {
    const version = transaction.message.version as any;
    if (version === 0) {
      return 'v0';
    }
    // Check for v1 (version 1) - only supported when SDK provides it
    if (version === 1 || version === '1') {
      return 'v1';
    }
    return 'legacy';
  }
  return 'legacy';
}

/**
 * Build a transaction and validate its size
 * Returns the transaction and its serialized size
 */
export async function buildAndValidateTransaction(
  content: string,
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  publicKey: PublicKey,
  connection?: Connection
): Promise<{
  transaction: Transaction | VersionedTransaction;
  serializedSize: number;
  version: TransactionVersionType;
  capabilities: SolanaTransactionCapabilities;
}> {
  const conn = connection || getConnection();
  const capabilities = await _detectTransactionCapabilities(conn);
  
  const transaction = await buildMemoDropTransaction(
    content,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    publicKey,
    conn
  );
  
  const serializedSize = getTransactionSize(transaction);
  const version = getTransactionVersion(transaction);
  
  return {
    transaction,
    serializedSize,
    version,
    capabilities,
  };
}

/**
 * Get the maximum transaction bytes for the given capabilities
 */
export function getMaxTransactionBytes(capabilities: SolanaTransactionCapabilities): number {
  if (capabilities.supportsV1) {
    return V1_TRANSACTION_MAX_BYTES;
  }
  return LEGACY_TRANSACTION_MAX_BYTES;
}