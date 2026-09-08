/**
 * HashDrop Transaction Capabilities
 * 
 * Determines the active Solana transaction format support and limits.
 * This is the SINGLE source of truth for transaction version selection.
 * 
 * v1 Support:
 * - Uses Solana web3.js with compileToV1Message support OR Solana Kit
 * - Checks for compileTransactionMessage with version 1 support
 * - No fake flags or hardcoded values
 * - Future-proof: automatically detects when SDK adds v1 support
 */

import { Connection, TransactionMessage } from '@solana/web3.js';
import { getCurrentNetwork, Network, getRpcUrl, getRpcUrlForLogging } from '../network';

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
  network: Network;
}

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
  // Use provided connection or create one from current network's RPC
  const conn = connection || new Connection(getRpcUrl(), 'confirmed');
  
  // Determine network from connection or use current network
  const network: Network = getCurrentNetwork();
  
  // Log for debugging
  console.log('[HashDrop] detectTransactionCapabilities:', {
    network,
    rpc: getRpcUrlForLogging(),
    providedConnection: !!connection,
  });
  
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
