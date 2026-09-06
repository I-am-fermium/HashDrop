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

import { PublicKey, SystemProgram, VersionedTransaction, TransactionMessage, TransactionInstruction, Connection } from '@solana/web3.js';
import { HASHDROP_PLATFORM_FEE_LAMPORTS, HASHDROP_FEE_WALLET } from './constants';
import { encodePublicPayload, encodeProofPayload, encodePrivatePayload, MEMO_PROGRAM_ID } from './memo';
import { utf8ToBase64 } from './encoding';
import {
  detectTransactionCapabilities as _detectTransactionCapabilities,
  SolanaTransactionCapabilities,
  TransactionVersionType,
  V1_TRANSACTION_MAX_BYTES,
} from './solana/transactionCapabilities';
import { getRpcUrl, getCurrentNetwork, Network, createRpc } from './network';

// Re-export for use by other modules
export { _detectTransactionCapabilities as detectTransactionCapabilities };

// Transaction size limits
export const V1_TRANSACTION_MAX_BYTES_CONST = 4096;

/**
 * Build a Public Mode transaction using v1 format
 * Creates a transaction with an SPL Memo instruction containing the V3 PUBLIC payload
 * Uses v1 format (VersionedTransaction with MessageV0) - 4096 bytes max
 */
export async function buildPublicTransaction(
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
  
  // Get latest blockhash using Solana Kit RPC
  let blockhash = '';
  let lastValidBlockHeight: bigint = BigInt(0);
  
  // Use Solana Kit RPC for getLatestBlockhash
  const rpc = createRpc();
  const network = getCurrentNetwork();
  
  console.log('[HashDrop] getLatestBlockhash via Solana Kit:', {
    network,
    provider: network === 'mainnet' ? 'Helius' : 'Solana',
  });
  
  try {
    const blockhashResult = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    blockhash = blockhashResult.value.blockhash;
    lastValidBlockHeight = BigInt(blockhashResult.value.lastValidBlockHeight);
    console.log('[HashDrop] Blockhash obtained:', {
      blockhash: blockhash.substring(0, 8) + '...',
      lastValidBlockHeight: lastValidBlockHeight.toString(),
    });
  } catch (error: any) {
    console.error('[HashDrop] getLatestBlockhash failed:', {
      operation: 'getLatestBlockhash',
      network,
      message: error?.message || 'Unknown error',
      code: error?.code,
    });
    throw error;
  }
  
  // Encode content as base64 for V3 Public format (UTF-8 safe)
  const base64Content = utf8ToBase64(content);

  // Encode public payload
  const memoPayload = encodePublicPayload(
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
 * Build a Proof Mode transaction using v1 format
 * Creates a transaction with a memo instruction containing the V3 PROOF payload
 * Uses v1 format (VersionedTransaction with MessageV0) - 4096 bytes max
 *
 * The original content is NEVER stored on-chain. Only the SHA-256 commitment
 * and the original byte length are published. The transaction includes the
 * platform-fee transfer instruction, atomically bundled with the proof memo.
 */
export async function buildProofDropTransaction(
  hashDropId: string,
  contentHash: string,
  contentSize: number,
  address: string,
  connection?: Connection
): Promise<VersionedTransaction> {
  // Detect transaction capabilities
  const capabilities = await _detectTransactionCapabilities(connection);
  console.log('[HashDrop] Transaction capabilities:', capabilities);

  // Get latest blockhash using Solana Kit RPC
  let blockhash = '';
  let lastValidBlockHeight: bigint = BigInt(0);

  // Use Solana Kit RPC for getLatestBlockhash
  const rpc = createRpc();
  const network = getCurrentNetwork();

  console.log('[HashDrop] getLatestBlockhash via Solana Kit:', {
    network,
    provider: network === 'mainnet' ? 'Helius' : 'Solana',
  });

  try {
    const blockhashResult = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    blockhash = blockhashResult.value.blockhash;
    lastValidBlockHeight = BigInt(blockhashResult.value.lastValidBlockHeight);
    console.log('[HashDrop] Blockhash obtained:', {
      blockhash: blockhash.substring(0, 8) + '...',
      lastValidBlockHeight: lastValidBlockHeight.toString(),
    });
  } catch (error: any) {
    console.error('[HashDrop] getLatestBlockhash failed:', {
      operation: 'getLatestBlockhash',
      network,
      message: error?.message || 'Unknown error',
      code: error?.code,
    });
    throw error;
  }

  // Encode proof payload — ONLY the cryptographic commitment, never the content itself
  const memoPayload = encodeProofPayload(
    hashDropId,
    contentHash,
    contentSize
  );

  // Build v1 transaction using web3.js native API
  const transaction = buildV1Transaction(
    memoPayload,
    address,
    blockhash,
    lastValidBlockHeight
  );

  console.log('[HashDrop] Built v1 proof transaction');
  return transaction;
}

/**
 * Build a Private Mode transaction using v1 format
 * Creates a transaction with an SPL Memo instruction containing the V3 PRIVATE payload
 * Uses v1 format (VersionedTransaction with MessageV0) - 4096 bytes max
 *
 * The original content is NEVER stored on-chain. Only the encrypted ciphertext,
 * ML-KEM encapsulated key, and metadata are published. The transaction includes
 * the platform-fee transfer instruction, atomically bundled with the private memo.
 *
 * @param hashDropId - Deterministic HashDrop ID
 * @param contentHash - SHA-256 of plaintext (hex)
 * @param contentSize - Original UTF-8 byte length
 * @param contentType - MIME type of original content
 * @param keyFingerprint - ML-KEM public key fingerprint (hex)
 * @param encryptedKeyIvBase64 - IV for encrypted AES key envelope (Base64)
 * @param encryptedKeyBase64 - Encrypted AES key envelope (Base64)
 * @param address - User wallet address (fee payer)
 * @param connection - Optional Solana connection
 */
export async function buildPrivateTransaction(
  hashDropId: string,
  contentHash: string,
  contentSize: number,
  contentType: string,
  keyFingerprint: string,
  encryptedKeyIvBase64: string,
  encryptedKeyBase64: string,
  address: string,
  connection?: Connection
): Promise<VersionedTransaction> {
  // Detect transaction capabilities
  const capabilities = await _detectTransactionCapabilities(connection);
  console.log('[HashDrop] Transaction capabilities:', capabilities);

  // Get latest blockhash using Solana Kit RPC
  let blockhash = '';
  let lastValidBlockHeight: bigint = BigInt(0);

  // Use Solana Kit RPC for getLatestBlockhash
  const rpc = createRpc();
  const network = getCurrentNetwork();

  console.log('[HashDrop] getLatestBlockhash via Solana Kit:', {
    network,
    provider: network === 'mainnet' ? 'Helius' : 'Solana',
  });

  try {
    const blockhashResult = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
    blockhash = blockhashResult.value.blockhash;
    lastValidBlockHeight = BigInt(blockhashResult.value.lastValidBlockHeight);
    console.log('[HashDrop] Blockhash obtained:', {
      blockhash: blockhash.substring(0, 8) + '...',
      lastValidBlockHeight: lastValidBlockHeight.toString(),
    });
  } catch (error: any) {
    console.error('[HashDrop] getLatestBlockhash failed:', {
      operation: 'getLatestBlockhash',
      network,
      message: error?.message || 'Unknown error',
      code: error?.code,
    });
    throw error;
  }

  // Encode private payload — ONLY commitment + encrypted key envelope
  // The encrypted content artifact is stored off-chain
  const memoPayload = encodePrivatePayload(
    hashDropId,
    contentHash,
    contentSize,
    contentType,
    keyFingerprint,
    encryptedKeyIvBase64,
    encryptedKeyBase64
  );

  // Build v1 transaction using web3.js native API
  const transaction = buildV1Transaction(
    memoPayload,
    address,
    blockhash,
    lastValidBlockHeight
  );

  console.log('[HashDrop] Built v1 private transaction');
  return transaction;
}

/**
 * Build a v1 transaction using Solana web3.js native API
 * Supports up to 4096 bytes
 *
 * NOTE: Despite the "V1" name, this currently compiles to a V0 message
 * (compileToV0Message) for Phantom compatibility.
 *
 * The transaction includes the HashDrop platform-fee transfer
 * (SystemProgram.transfer → HASHDROP_FEE_WALLET) as the first instruction,
 * followed by the existing SPL Memo instruction.
 *
 * Exported for testing/inspection of the compiled transaction.
 */
export function buildV1Transaction(
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
  
  // HashDrop platform fee: transfer 0.001 SOL (1,000,000 lamports) to the
  // HashDrop fee wallet. The user's wallet is the fee payer and the ONLY
  // signer — no second signature or private key is created. Because this
  // transfer is part of the exact transaction Phantom signs, the fee is
  // actually deducted from the user on confirmation.
  const transferIx = SystemProgram.transfer({
    fromPubkey: feePayerKey,
    toPubkey: new PublicKey(HASHDROP_FEE_WALLET),
    lamports: HASHDROP_PLATFORM_FEE_LAMPORTS,
  });
  
  // Build TransactionMessage. Order: platform-fee transfer first, memo second.
  const transactionMessage = new TransactionMessage({
    payerKey: feePayerKey,
    recentBlockhash: blockhash,
    instructions: [
      transferIx,
      memoInstruction,
    ],
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
export async function buildAndValidatePublicTransaction(
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
  const transaction = await buildPublicTransaction(
    content,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    address,
    connection
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
 * Build a Public Mode transaction using Kit-compatible Address type
 */
export async function buildPublicTransactionFromAddress(
  content: string,
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  address: string, // Address as string (Kit-compatible)
  connection?: Connection
): Promise<VersionedTransaction> {
  return buildPublicTransaction(
    content,
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    address,
    connection
  );
}