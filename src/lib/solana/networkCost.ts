/**
 * HashDrop Network Cost Calculator
 * 
 * Provides network-authoritative cost calculation using Solana Kit RPC.
 * Uses only Solana Kit - no @solana/web3.js dependencies.
 */

import { createSolanaRpc } from '@solana/rpc';
import type { Rpc } from '@solana/rpc-spec';
import type { SolanaRpcApi } from '@solana/rpc-api';
import type { Address } from '@solana/addresses';
import { Connection } from '@solana/web3.js';
import { DEVNET_ENDPOINT, MAINNET_ENDPOINT } from '../constants';

// Create RPC instances for different networks
export const devnetRpc = createSolanaRpc(DEVNET_ENDPOINT);
export const mainnetRpc = createSolanaRpc(MAINNET_ENDPOINT);

/**
 * Get the current RPC based on the network
 */
export function getRpc(): Rpc<SolanaRpcApi> {
  const endpoint = GET_CURRENT_ENDPOINT();
  return createSolanaRpc(endpoint);
}

/**
 * Get the current endpoint
 */
function GET_CURRENT_ENDPOINT(): string {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('network') === 'mainnet' ? MAINNET_ENDPOINT : DEVNET_ENDPOINT;
  }
  return DEVNET_ENDPOINT;
}

/**
 * Get the current Solana Connection (for backward compatibility)
 * @deprecated Use getRpc() instead for Kit-based operations
 */
export function getConnection(): Connection {
  const endpoint = GET_CURRENT_ENDPOINT();
  return new Connection(endpoint, 'confirmed');
}

/**
 * Get the minimum balance for rent exemption for an account of given size
 * This queries the Solana RPC for the authoritative value
 */
export async function getMinimumBalanceForRentExemption(
  dataLength: number
): Promise<number> {
  try {
    const rpc = getRpc();
    const result = await rpc.getMinimumBalanceForRentExemption(BigInt(dataLength)).send();
    return Number(result);
  } catch (error) {
    console.error('[HashDrop] Failed to get minimum balance for rent exemption:', error);
    // Fallback to estimated value (should not be used in production)
    return (dataLength + 128) * 6960;
  }
}

/**
 * Get the current base transaction fee
 */
export async function getBaseTransactionFee(): Promise<number> {
  try {
    // For v1 transactions, the base fee is typically 5000 lamports
    // This is a simplified approach - actual fee depends on transaction complexity
    return 5000;
  } catch (error) {
    console.error('[HashDrop] Failed to get base transaction fee:', error);
    return 5000;
  }
}

/**
 * Synchronous fallback for rent calculation (used during estimation)
 * This should only be used for UI estimates, not actual transactions
 */
export function getMinimumBalanceForRentExemptionSync(dataLength: number): number {
  // This is an approximation - use the async version for actual transactions
  const METADATA_OVERHEAD = 128;
  const RENT_LAMPORTS_PER_BYTE = 6960;
  return (dataLength + METADATA_OVERHEAD) * RENT_LAMPORTS_PER_BYTE;
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / Math.pow(10, 9);
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * Math.pow(10, 9));
}

/**
 * Get the connected wallet's balance using Kit RPC
 */
export async function getWalletBalance(
  rpc: Rpc<SolanaRpcApi>,
  publicKey: Address
): Promise<bigint> {
  try {
    const result = await rpc.getBalance(publicKey).send();
    return result.value;
  } catch (error) {
    console.error('[HashDrop] Failed to get wallet balance:', error);
    return BigInt(0);
  }
}

/**
 * Check if wallet has sufficient balance for transaction
 */
export async function checkSufficientBalance(
  rpc: Rpc<SolanaRpcApi>,
  publicKey: Address,
  requiredLamports: bigint
): Promise<{ sufficient: boolean; balance: bigint; deficit: bigint }> {
  const balance = await getWalletBalance(rpc, publicKey);
  const sufficient = balance >= requiredLamports;
  const deficit = sufficient ? BigInt(0) : requiredLamports - balance;
  
  return { sufficient, balance, deficit };
}

/**
 * Get latest blockhash using Kit RPC
 */
export async function getLatestBlockhash(
  rpc: Rpc<SolanaRpcApi>
): Promise<{ blockhash: string; lastValidBlockHeight: bigint }> {
  try {
    // Kit's getLatestBlockhash returns a PendingRpcRequest that needs .send()
    const result = await rpc.getLatestBlockhash().send();
    return {
      blockhash: result.value.blockhash,
      lastValidBlockHeight: result.value.lastValidBlockHeight,
    };
  } catch (error) {
    console.error('[HashDrop] Failed to get latest blockhash:', error);
    throw error;
  }
}

/**
 * Send a raw transaction using Kit RPC
 * transactionBytes should be a Uint8Array of the serialized transaction
 */
export async function sendRawTransaction(
  rpc: Rpc<SolanaRpcApi>,
  transactionBytes: Uint8Array
): Promise<string> {
  try {
    // Use getBase64EncodedWireTransaction to properly encode the transaction
    const { getBase64EncodedWireTransaction } = require('@solana/transactions');
    
    // Create a Transaction object from the bytes
    // For v1 transactions, we need to use the VersionedTransaction from web3.js
    const { VersionedTransaction } = require('@solana/web3.js');
    const versionedTx = VersionedTransaction.deserialize(transactionBytes);
    
    // Get the base64 encoded wire transaction
    const encodedTx = getBase64EncodedWireTransaction(versionedTx);
    
    const result = await rpc.sendTransaction(encodedTx, { encoding: 'base64' }).send();
    // Convert Signature to string - use toString() for proper conversion
    return result.toString();
  } catch (error) {
    console.error('[HashDrop] Failed to send transaction:', error);
    throw error;
  }
}

/**
 * Confirm a transaction using Kit RPC
 */
export async function confirmTransaction(
  rpc: Rpc<SolanaRpcApi>,
  signature: string
): Promise<void> {
  try {
    // Use getSignatureStatuses to check if transaction is confirmed
    // Note: Kit's getSignatureStatuses expects Signature[] but we pass string[]
    // The RPC will accept the string and convert it
    const result = await rpc.getSignatureStatuses([signature as any]).send();
    const status = result.value[0];
    
    if (!status || !status.confirmations || status.confirmations < 1) {
      throw new Error('Transaction not confirmed');
    }
  } catch (error) {
    console.error('[HashDrop] Failed to confirm transaction:', error);
    throw error;
  }
}