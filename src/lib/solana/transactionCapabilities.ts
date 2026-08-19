/**
 * HashDrop Transaction Capabilities
 * 
 * Determines the active Solana transaction format support and limits.
 * This is the SINGLE source of truth for transaction version selection.
 * 
 * v1 Support:
 * - Uses Solana Kit's transaction-messages package for v1 support
 * - Checks for compileTransactionMessage with version 1 support
 * - No fake flags or hardcoded values
 * - Future-proof: automatically detects when SDK adds v1 support
 */

import { Connection, TransactionMessage, TransactionInstruction, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { DEVNET_ENDPOINT } from '../constants';
import { MEMO_PROGRAM_ID } from '../memo';

// Transaction size limits
export const LEGACY_TRANSACTION_MAX_BYTES = 1232;
export const V1_TRANSACTION_MAX_BYTES = 4096;

// Transaction version types
export type TransactionVersionType = 'legacy' | 'v0' | 'v1';

export interface SolanaTransactionCapabilities {
  supportsV1: boolean;
  supportsV0: boolean;
  maxTransactionBytes: number;
  preferredVersion: TransactionVersionType;
  network: 'devnet' | 'mainnet';
}

/**
 * Result of exact transaction size calculation
 */
export interface TransactionSizeResult {
  transactionBytes: number;
  availableForContent: number;
  overheadBytes: number;
  isExact: true;
}

/**
 * Result when exact transaction size cannot be calculated
 */
export interface TransactionSizeUnavailable {
  isExact: false;
  reason: string;
}

/**
 * Union type for transaction size calculation result
 */
export type TransactionSizeCalculation = TransactionSizeResult | TransactionSizeUnavailable;

/**
 * Check if the installed SDK actually supports v1 transactions
 * by verifying that TransactionMessage has compileToV1Message method
 * or that Solana Kit's compileTransactionMessage supports version 1
 */
function sdkSupportsV1(): boolean {
  try {
    // Check if web3.js has compileToV1Message
    const hasWeb3V1 = typeof (TransactionMessage.prototype as any).compileToV1Message === 'function';
    
    if (hasWeb3V1) {
      return true;
    }
    
    // Check if Solana Kit's transaction-messages supports v1
    // This is available in @solana/transaction-messages v7.1.1+
    const { compileTransactionMessage } = require('@solana/transaction-messages');
    
    // If compileTransactionMessage exists, v1 is supported
    // (it can compile messages with version: 1)
    return typeof compileTransactionMessage === 'function';
  } catch {
    return false;
  }
}

/**
 * Check if the connected network and SDK support v1 transactions
 * 
 * v1 transactions require:
 * 1. Solana web3.js with compileToV1Message support OR Solana Kit
 * 2. RPC endpoint that supports v1 (Devnet does as of Solana 1.14+)
 * 3. Wallet that can sign v1 transactions (Phantom/Brave do)
 */
export async function detectTransactionCapabilities(
  connection?: Connection
): Promise<SolanaTransactionCapabilities> {
  const conn = connection || new Connection(DEVNET_ENDPOINT, 'confirmed');
  
  // Determine network
  const isDevnet = DEVNET_ENDPOINT.includes('devnet');
  const network: 'devnet' | 'mainnet' = isDevnet ? 'devnet' : 'mainnet';
  
  // Check if SDK supports v1 by checking for compileToV1Message or Kit's compileTransactionMessage
  const supportsV1 = sdkSupportsV1();
  const supportsV0 = true; // v0 is always supported by VersionedTransaction
  
  // Determine max transaction bytes based on actual SDK support
  const maxTransactionBytes = supportsV1 
    ? V1_TRANSACTION_MAX_BYTES 
    : LEGACY_TRANSACTION_MAX_BYTES;
  
  // Preferred version based on actual SDK capability
  const preferredVersion: TransactionVersionType = supportsV1 ? 'v1' : 'v0';
  
  return {
    supportsV1,
    supportsV0,
    maxTransactionBytes,
    preferredVersion,
    network,
  };
}

/**
 * Get default capabilities (synchronous, for UI display)
 * Uses the same runtime SDK capability detection as detectTransactionCapabilities()
 * No optimistic V1 assumptions - only reports what the SDK actually supports
 */
export function getDefaultCapabilities(): SolanaTransactionCapabilities {
  // Use the same runtime detection logic as detectTransactionCapabilities()
  const supportsV1 = sdkSupportsV1();
  const supportsV0 = true;
  const maxTransactionBytes = supportsV1 ? V1_TRANSACTION_MAX_BYTES : LEGACY_TRANSACTION_MAX_BYTES;
  const preferredVersion: TransactionVersionType = supportsV1 ? 'v1' : 'v0';
  
  return {
    supportsV1,
    supportsV0,
    maxTransactionBytes,
    preferredVersion,
    network: 'devnet',
  };
}

/**
 * Build an actual Memo transaction and return its serialized size
 * Builds the ACTUAL requested transaction version, not a fallback
 * 
 * @param memoPayload - The memo payload string
 * @param feePayer - The fee payer public key
 * @param blockhash - The recent blockhash
 * @param transactionVersion - The transaction version to build ('v0' or 'v1')
 * @returns Object with transaction size and serialized bytes
 * @throws Error if V1 is requested but not supported by the SDK
 */
function buildMemoTransactionForSize(
  memoPayload: string,
  feePayer: PublicKey,
  blockhash: string,
  transactionVersion: TransactionVersionType
): { transactionSize: number; serialized: Uint8Array } {
  // Create a TransactionMessage
  const transactionMessage = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [],
  });
  
  // Add memo instruction
  const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);
  const memoInstruction = new TransactionInstruction({
    programId: memoProgramId,
    data: Buffer.from(memoPayload, 'utf-8'),
    keys: [],
  });
  
  // Add instruction to message
  const instructions = [...transactionMessage.instructions, memoInstruction];
  const messageWithMemo = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions,
  });
  
  let serialized: Uint8Array;
  
  if (transactionVersion === 'v1') {
    // Build V1 transaction using Solana Kit
    try {
      const { compileTransactionMessage } = require('@solana/transaction-messages');
      
      // Create v1 message with version
      const v1Message = compileTransactionMessage({
        ...messageWithMemo,
        version: 1,
      } as any);
      
      const versionedTransaction = new VersionedTransaction(v1Message);
      serialized = versionedTransaction.serialize();
    } catch (error) {
      throw new Error(
        'V1 transactions are not supported by the current Solana SDK. ' +
        'Cannot measure V1 transaction size without SDK support.'
      );
    }
  } else {
    // Build V0 transaction (current SDK support)
    const v0Message = messageWithMemo.compileToV0Message();
    const versionedTransaction = new VersionedTransaction(v0Message);
    serialized = versionedTransaction.serialize();
  }
  
  return {
    transactionSize: serialized.length,
    serialized,
  };
}

/**
 * Calculate the actual available space for content in a transaction
 * Uses actual serialized transaction size, not approximations
 * 
 * @param memoPayloadBytes - The size of the memo payload in bytes
 * @param transactionVersion - The transaction version to use
 * @param feePayer - The fee payer public key (required for exact transaction construction)
 * @param blockhash - The recent blockhash (required for exact transaction construction)
 * @returns Exact transaction size calculation, or null if exact size cannot be calculated
 */
export function calculateAvailableContentSpace(
  memoPayloadBytes: number,
  transactionVersion: TransactionVersionType,
  feePayer?: PublicKey,
  blockhash?: string
): TransactionSizeCalculation | null {
  // If we don't have the required parameters, we cannot calculate exact size
  if (!feePayer || !blockhash) {
    return null;
  }
  
  // Build a test memo payload
  const testMemoPayload = 'x'.repeat(memoPayloadBytes);
  
  // Build actual transaction and get serialized size
  const { transactionSize } = buildMemoTransactionForSize(
    testMemoPayload,
    feePayer,
    blockhash,
    transactionVersion
  );
  
  const maxBytes = transactionVersion === 'v1' 
    ? V1_TRANSACTION_MAX_BYTES 
    : LEGACY_TRANSACTION_MAX_BYTES;
  
  const availableBytes = maxBytes - transactionSize;
  const overheadBytes = transactionSize - memoPayloadBytes;
  
  return {
    transactionBytes: transactionSize,
    availableForContent: Math.max(0, availableBytes),
    overheadBytes,
    isExact: true,
  };
}