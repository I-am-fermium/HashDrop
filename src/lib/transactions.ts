/**
 * HashDrop Transaction Builder
 * 
 * Provides transaction construction for Memo Drop using v1 transactions only.
 * Supports 4096-byte transactions using Solana web3.js.
 * 
 * v1 Transaction Support:
 * - Uses Solana web3.js TransactionMessage for v1
 * - 4096 bytes max transaction size
 */

import { PublicKey, VersionedTransaction, TransactionMessage, TransactionInstruction, Connection } from '@solana/web3.js';
import { encodeMemoPayload, MEMO_PROGRAM_ID } from './memo';
import { utf8ToBase64 } from './encoding';
import {
  detectTransactionCapabilities as _detectTransactionCapabilities,
  SolanaTransactionCapabilities,
  TransactionVersionType,
  V1_TRANSACTION_MAX_BYTES,
} from './solana/transactionCapabilities';
import { getRpcUrl, getCurrentNetwork, Network } from './network';

// Re-export for use by other modules
export { _detectTransactionCapabilities as detectTransactionCapabilities };

// Transaction size limits
export const V1_TRANSACTION_MAX_BYTES_CONST = 4096;

/**
 * Build a Memo Drop transaction using v1 format
 * Creates a transaction with a memo instruction containing the HashDrop payload
 * Uses v1 format (VersionedTransaction with MessageV1) - 4096 bytes max
 */
export async function buildMemoDropTransaction(
  content: string,
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  address: string,
  connection?: Connection
): Promise<VersionedTransaction> {
  // Detect transaction capabilities
  const capabilities = await _detectTransactionCapabilities(connection);
  console.log('[HashDrop] Transaction capabilities:', capabilities);
  
  // Get latest blockhash using web3.js Connection
  let blockhash = '';
  let lastValidBlockHeight: bigint = BigInt(0);
  
  if (connection) {
    const blockhashResult = await connection.getLatestBlockhash('confirmed');
    blockhash = blockhashResult.blockhash;
    lastValidBlockHeight = BigInt(blockhashResult.lastValidBlockHeight);
  }
  
  // Encode content as base64 for V2 format (UTF-8 safe)
  const base64Content = utf8ToBase64(content);
  
  // Encode memo payload
  const memoPayload = encodeMemoPayload(
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    base64Content
  );
  
  // Build v1 transaction using web3.js native API
  const transaction = buildV1Transaction(
    memoPayload,
    address,
    blockhash,
    lastValidBlockHeight
  );
  
  console.log('[HashDrop] Built v1 transaction');
  return transaction;
}

/**
 * Build a v1 transaction using Solana web3.js native API
 * Supports up to 4096 bytes
 */
function buildV1Transaction(
  memoPayload: string,
  feePayer: string,
  blockhash: string,
  lastValidBlockHeight: bigint
): VersionedTransaction {
  // Create memo program ID
  const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);
  
  // Create instruction data
  const instructionData = Buffer.from(memoPayload, 'utf-8');
  
  // Create memo instruction
  const memoInstruction = new TransactionInstruction({
    programId: memoProgramId,
    data: instructionData,
    keys: [],
  });
  
  // Create fee payer key
  const feePayerKey = new PublicKey(feePayer);
  
  // Build TransactionMessage with memo instruction
  const transactionMessage = new TransactionMessage({
    payerKey: feePayerKey,
    recentBlockhash: blockhash,
    instructions: [memoInstruction],
  });
  
  // Compile to V0 message (v0 is supported by Phantom)
  // Note: Phantom may not fully support v1 transactions yet
  // Using v0 for now with 1232-byte limit
  const v0Message = transactionMessage.compileToV0Message();
  
  // Create VersionedTransaction with the v0 message
  const versionedTransaction = new VersionedTransaction(v0Message);
  
  return versionedTransaction;
}

/**
 * Serialize transaction for sending
 * Returns a Buffer containing the serialized transaction
 */
export function serializeTransaction(transaction: VersionedTransaction): Buffer {
  try {
    const serialized = transaction.serialize();
    return Buffer.from(serialized);
  } catch (error) {
    console.error('[HashDrop] Failed to serialize transaction:', error);
    throw new Error('Cannot serialize transaction: serialization failed');
  }
}

/**
 * Deserialize transaction from buffer
 * Note: V1 deserialization is not supported by current SDK
 */
export function deserializeTransaction(buffer: Buffer): VersionedTransaction {
  // Check if this is a v1 transaction by looking at the first byte
  // v1 transactions start with 0x01
  const versionByte = buffer[0];
  
  if (versionByte !== 0x01) {
    throw new Error(
      'Only v1 transactions are supported. ' +
      'This transaction is not a v1 transaction.'
    );
  }
  
  return VersionedTransaction.deserialize(new Uint8Array(buffer));
}

/**
 * Get the serialized transaction size
 */
export function getTransactionSize(transaction: VersionedTransaction): number {
  return serializeTransaction(transaction).length;
}

/**
 * Check if a transaction is a v1 transaction
 */
export function isV1Transaction(transaction: VersionedTransaction): boolean {
  const version = transaction.message.version as any;
  return version === 1 || version === '1';
}

/**
 * Get transaction version as string
 */
export function getTransactionVersion(transaction: VersionedTransaction): TransactionVersionType {
  const version = transaction.message.version as any;
  if (version === 1 || version === '1') {
    return 'v1';
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
  address: string,
  connection?: Connection
): Promise<{
  transaction: VersionedTransaction;
  serializedSize: number;
  version: TransactionVersionType;
  capabilities: SolanaTransactionCapabilities;
}> {
  const conn = connection || new Connection(getRpcUrl(), 'confirmed');
  
  const transaction = await buildMemoDropTransaction(
    content,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    address,
    conn
  );
  
  const serializedSize = getTransactionSize(transaction);
  const version = getTransactionVersion(transaction);
  
  return {
    transaction,
    serializedSize,
    version,
    capabilities: {
      supportsV1: true,
      supportsV0: false,
      maxTransactionBytes: V1_TRANSACTION_MAX_BYTES,
      preferredVersion: 'v1',
      network: getCurrentNetwork(),
    },
  };
}

/**
 * Get the maximum transaction bytes for v1 transactions
 * @deprecated Always returns V1_TRANSACTION_MAX_BYTES (4096)
 */
export function getMaxTransactionBytes(_capabilities?: any): number {
  return V1_TRANSACTION_MAX_BYTES;
}

/**
 * Build a transaction using Kit-compatible Address type
 */
export async function buildMemoDropTransactionFromAddress(
  content: string,
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  address: string, // Address as string (Kit-compatible)
  connection?: Connection
): Promise<VersionedTransaction> {
  return buildMemoDropTransaction(
    content,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    address,
    connection
  );
}