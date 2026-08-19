/**
 * HashDrop Transaction Builder
 * 
 * Provides transaction construction for Memo Drop using v1 transactions only.
 * Supports 4096-byte transactions using Solana Kit.
 * 
 * v1 Transaction Support:
 * - Uses Solana Kit's compileTransactionMessage for v1
 * - 4096 bytes max transaction size
 */

import { Address } from '@solana/addresses';
import { encodeMemoPayload, MEMO_PROGRAM_ID } from './memo';
import {
  detectTransactionCapabilities as _detectTransactionCapabilities,
  SolanaTransactionCapabilities,
  TransactionVersionType,
  V1_TRANSACTION_MAX_BYTES,
} from './solana/transactionCapabilities';

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
  address: Address | string,
  connection?: any // Connection type from web3.js for backward compatibility
): Promise<any> { // VersionedTransaction from web3.js
  // Detect transaction capabilities
  const capabilities = await _detectTransactionCapabilities(connection);
  console.log('[HashDrop] Transaction capabilities:', capabilities);
  
  // Get latest blockhash using Kit RPC
  const { getLatestBlockhash } = require('./solana/networkCost');
  const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(
    connection ? await connection.getLatestBlockhash('confirmed') : { blockhash: '', lastValidBlockHeight: BigInt(0) }
  );
  
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
  
  // Convert string to Address if needed
  const feePayer = typeof address === 'string' ? address : address;
  
  // Build v1 transaction
  const transaction = buildV1Transaction(
    memoPayload,
    feePayer,
    blockhash,
    lastValidBlockHeight
  );
  
  console.log('[HashDrop] Built v1 transaction');
  return transaction;
}

/**
 * Build a v1 transaction using Solana Kit's compileTransactionMessage
 * Supports up to 4096 bytes
 */
function buildV1Transaction(
  memoPayload: string,
  feePayer: Address | string,
  blockhash: string,
  lastValidBlockHeight: number
): any { // VersionedTransaction from web3.js
  // Use Solana Kit's compileTransactionMessage for v1 support
  const { compileTransactionMessage } = require('@solana/transaction-messages');
  const { setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction } = require('@solana/transaction-messages');
  
  // Create memo program ID as Address
  const memoProgramId = MEMO_PROGRAM_ID;
  
  // Create instruction data
  const instructionData = Buffer.from(memoPayload, 'utf-8');
  
  // Create instruction using Kit's instruction API
  const instruction = {
    programAddress: memoProgramId,
    keys: [],
    data: instructionData,
  };
  
  // Create a v1 transaction message object directly
  // createTransactionMessage doesn't support version 1, so we create the object manually
  const v1Message = {
    version: 1,
    instructions: [],
  } as any;
  
  // Apply transformations using Kit's API
  let message = v1Message;
  message = setTransactionMessageFeePayer(feePayer, message);
  message = setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: BigInt(lastValidBlockHeight) }, message);
  message = appendTransactionMessageInstruction(instruction, message);
  
  // Compile to v1 message
  const compiledMessage = compileTransactionMessage(message);
  
  // Create VersionedTransaction with v1 message (from web3.js)
  const { VersionedTransaction } = require('@solana/web3.js');
  const versionedTransaction = new VersionedTransaction(compiledMessage);
  
  return versionedTransaction;
}

/**
 * Serialize transaction for sending
 */
export function serializeTransaction(transaction: any): Buffer { // VersionedTransaction
  return Buffer.from(transaction.serialize());
}

/**
 * Deserialize transaction from buffer
 * Note: V1 deserialization is not supported by current SDK
 */
export function deserializeTransaction(buffer: Buffer): any { // VersionedTransaction
  // Check if this is a v1 transaction by looking at the first byte
  // v1 transactions start with 0x01
  const versionByte = buffer[0];
  
  if (versionByte !== 0x01) {
    throw new Error(
      'Only v1 transactions are supported. ' +
      'This transaction is not a v1 transaction.'
    );
  }
  
  const { VersionedTransaction } = require('@solana/web3.js');
  return VersionedTransaction.deserialize(new Uint8Array(buffer));
}

/**
 * Get the serialized transaction size
 */
export function getTransactionSize(transaction: any): number { // VersionedTransaction
  return transaction.serialize().length;
}

/**
 * Check if a transaction is a v1 transaction
 */
export function isV1Transaction(transaction: any): boolean { // VersionedTransaction
  const version = transaction.message.version as any;
  return version === 1 || version === '1';
}

/**
 * Get transaction version as string
 */
export function getTransactionVersion(transaction: any): TransactionVersionType { // VersionedTransaction
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
  address: Address | string,
  connection?: any // Connection from web3.js
): Promise<{
  transaction: any; // VersionedTransaction
  serializedSize: number;
  version: TransactionVersionType;
  capabilities: SolanaTransactionCapabilities;
}> {
  const conn = connection || new (require('@solana/web3.js').Connection)('https://api.devnet.solana.com', 'confirmed');
  
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
      network: 'devnet',
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
  connection?: any // Connection from web3.js
): Promise<any> { // VersionedTransaction
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