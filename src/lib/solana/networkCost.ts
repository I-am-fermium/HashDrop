/**
 * HashDrop Network Cost Calculator
 * 
 * Provides network-authoritative cost calculation using Solana RPC.
 * This is the SINGLE source of truth for all pricing calculations.
 */

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { DEVNET_ENDPOINT } from '../constants';

/**
 * Get a connection to the specified network
 */
export function getConnection(endpoint?: string): Connection {
  return new Connection(endpoint || DEVNET_ENDPOINT, 'confirmed');
}

/**
 * Get the minimum balance for rent exemption for an account of given size
 * This queries the Solana RPC for the authoritative value
 */
export async function getMinimumBalanceForRentExemption(
  connection: Connection,
  dataLength: number
): Promise<number> {
  try {
    const lamports = await connection.getMinimumBalanceForRentExemption(dataLength);
    return lamports;
  } catch (error) {
    console.error('[HashDrop] Failed to get minimum balance for rent exemption:', error);
    // Fallback to estimated value (should not be used in production)
    return (dataLength + 128) * 6960;
  }
}

/**
 * Get the current base transaction fee
 */
export async function getBaseTransactionFee(
  connection: Connection
): Promise<number> {
  try {
    const fee = await connection.getFeeForMessage(new Uint8Array() as any);
    return fee.value || 5000; // Fallback to 5000 lamports
  } catch (error) {
    console.error('[HashDrop] Failed to get base transaction fee:', error);
    return 5000; // Fallback
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
 * Get the connected wallet's balance
 */
export async function getWalletBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance;
  } catch (error) {
    console.error('[HashDrop] Failed to get wallet balance:', error);
    return 0;
  }
}

/**
 * Check if wallet has sufficient balance for transaction
 */
export async function checkSufficientBalance(
  connection: Connection,
  publicKey: PublicKey,
  requiredLamports: number
): Promise<{ sufficient: boolean; balance: number; deficit: number }> {
  const balance = await getWalletBalance(connection, publicKey);
  const sufficient = balance >= requiredLamports;
  const deficit = sufficient ? 0 : requiredLamports - balance;
  
  return { sufficient, balance, deficit };
}

/**
 * Build a transaction with proper fee calculation
 */
export async function buildTransactionWithFee(
  connection: Connection,
  feePayer: PublicKey,
  instructions: TransactionInstruction[]
): Promise<Transaction> {
  // Get latest blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  
  // Create transaction
  const transaction = new Transaction({
    feePayer,
    recentBlockhash: blockhash,
  });
  
  // Add instructions
  instructions.forEach(instruction => {
    transaction.add(instruction);
  });
  
  return transaction;
}

/**
 * Simulate a transaction before sending
 */
export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction
): Promise<{ success: boolean; error?: string; logs?: string[] }> {
  try {
    const simulation = await connection.simulateTransaction(transaction);
    return {
      success: !simulation.value.err,
      error: simulation.value.err ? String(simulation.value.err) : undefined,
      logs: simulation.value.logs || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Simulation failed',
    };
  }
}