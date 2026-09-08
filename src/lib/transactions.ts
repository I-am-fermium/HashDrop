/**
 * HashDrop Transaction Builder
 *
 * Assembles HashDrop Protocol V3 payloads (PUBLIC / PROOF / PRIVATE memo
 * payloads from ./memo) into Solana transactions with the platform-fee
 * transfer instruction.
 *
 * Solana transaction version (container only — HashDrop Protocol V3 is
 * independent of it):
 * - Current:  compiles to a Solana V0 message (compileToV0Message) —
 *             VersionedTransaction, 1232-byte packet ceiling.
 * - Future:   Solana V1 / 4096-byte ceiling, once SDK + wallet support exist.
 *             buildV1Transaction() is intentionally retained (name unchanged)
 *             as the transaction assembly / V1 migration boundary.
 */

import { PublicKey, SystemProgram, VersionedTransaction, TransactionMessage, TransactionInstruction, Connection } from '@solana/web3.js';
import { HASHDROP_PLATFORM_FEE_LAMPORTS, HASHDROP_FEE_WALLET } from './constants';
import { encodePublicPayload, encodeProofPayload, encodePrivatePayload, MEMO_PROGRAM_ID } from './memo';
import { utf8ToBase64 } from './encoding';
import {
  detectTransactionCapabilities as _detectTransactionCapabilities,
  LEGACY_TRANSACTION_MAX_BYTES,
} from './solana/transactionCapabilities';
import { getRpcUrl, getCurrentNetwork, Network, createRpc } from './network';

// Re-export for use by other modules
export { _detectTransactionCapabilities as detectTransactionCapabilities };

/**
 * Build a Public Mode transaction
 * Creates a transaction with an SPL Memo instruction containing the V3 PUBLIC payload
 * (HashDrop Protocol V3) plus the platform-fee transfer instruction.
 * Compiled to a Solana V0 message (VersionedTransaction) — 1232-byte packet ceiling.
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
  
  // Assemble the transaction via the shared boundary (currently compiles to Solana v0)
  const transaction = buildV1Transaction(
    memoPayload,
    address,
    blockhash,
    lastValidBlockHeight
  );
  
  console.log('[HashDrop] Built transaction (Solana v0)');
  return transaction;
}

/**
 * Build a Proof Mode transaction
 * Creates a transaction with a memo instruction containing the V3 PROOF payload
 * (HashDrop Protocol V3) plus the platform-fee transfer instruction.
 * Compiled to a Solana V0 message (VersionedTransaction) — 1232-byte packet ceiling.
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

  // Assemble the transaction via the shared boundary (currently compiles to Solana v0)
  const transaction = buildV1Transaction(
    memoPayload,
    address,
    blockhash,
    lastValidBlockHeight
  );

  console.log('[HashDrop] Built proof transaction (Solana v0)');
  return transaction;
}

/**
 * Build a Private Mode transaction
 * Creates a transaction with an SPL Memo instruction containing the V3 PRIVATE payload
 * (HashDrop Protocol V3) plus the platform-fee transfer instruction.
 * Compiled to a Solana V0 message (VersionedTransaction) — 1232-byte packet ceiling.
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

  // Assemble the transaction via the shared boundary (currently compiles to Solana v0)
  const transaction = buildV1Transaction(
    memoPayload,
    address,
    blockhash,
    lastValidBlockHeight
  );

  console.log('[HashDrop] Built private transaction (Solana v0)');
  return transaction;
}

/**
 * Transaction assembly / Solana version migration boundary.
 *
 * Assembles the HashDrop transaction (platform-fee transfer + SPL Memo) from a
 * prepared V3 payload and compiles it to its wire format.
 *
 * HashDrop Protocol V3 is independent of the Solana transaction version.
 * - Current implementation: compiles to a Solana V0 message
 *   (compileToV0Message) — VersionedTransaction, 1232-byte packet ceiling.
 * - Future target: compile to Solana V1 — 4096-byte ceiling — once SDK and
 *   wallet support exist. V1 is NOT enabled today.
 *
 * The name buildV1Transaction() is intentionally retained as the migration
 * boundary; do not rename it to reflect the current wire format.
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

// Fixed dummy blockhash used ONLY for size measurement. A blockhash is always
// encoded as exactly 32 bytes in the compiled message regardless of its value,
// so it does not affect the measured serialized size.
const SIZE_PREVIEW_BLOCKHASH = '11111111111111111111111111111111';

/**
 * Measure the exact serialized size of the Public Mode transaction for the
 * given content, using the SAME encoding and compilation path as
 * buildPublicTransaction (V3 PUBLIC memo with the base64-encoded content,
 * plus the platform-fee transfer, compiled to a v0 message). No RPC is
 * required — the blockhash value does not affect serialized size.
 *
 * Returns the exact byte count the real publish flow would submit, or null
 * when the transaction cannot be serialized because it exceeds the legacy
 * packet limit (the same rejection the real publish flow hits).
 */
export function measurePublicTransactionSize(
  content: string,
  hashDropId: string,
  contentHash: string,
  contentType: string,
  contentSize: number,
  feePayer: string
): { size: number | null; maxBytes: number } {
  // Encode content as base64 for V3 Public format (UTF-8 safe) — identical to
  // the encoding performed inside buildPublicTransaction.
  const base64Content = utf8ToBase64(content);

  const memoPayload = encodePublicPayload(
    hashDropId,
    contentHash,
    contentType,
    contentSize,
    base64Content
  );

  try {
    const transaction = buildV1Transaction(
      memoPayload,
      feePayer,
      SIZE_PREVIEW_BLOCKHASH,
      BigInt(0)
    );
    return { size: serializeTransaction(transaction).length, maxBytes: LEGACY_TRANSACTION_MAX_BYTES };
  } catch {
    // Exceeds the serialized transaction limit — rejected exactly as the real
    // publish flow would reject it.
    return { size: null, maxBytes: LEGACY_TRANSACTION_MAX_BYTES };
  }
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
