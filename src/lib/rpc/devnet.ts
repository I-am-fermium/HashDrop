/**
 * HashDrop Devnet RPC Configuration
 * 
 * Provides network-specific RPC configuration for Devnet.
 * Uses environment variable NEXT_PUBLIC_SOLANA_DEVNET_RPC if set,
 * otherwise falls back to the default Solana Devnet RPC.
 */

import { createSolanaRpc } from '@solana/rpc';
import type { Rpc } from '@solana/rpc-spec';
import type { SolanaRpcApi } from '@solana/rpc-api';
import { Connection } from '@solana/web3.js';

// Default Devnet RPC endpoint
const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

// Get Devnet RPC URL from environment or use default
export const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC || DEFAULT_DEVNET_RPC;

/**
 * Create a Solana Kit RPC instance for Devnet
 */
export function createDevnetRpc(): Rpc<SolanaRpcApi> {
  return createSolanaRpc(DEVNET_RPC_URL);
}

/**
 * Create a web3.js Connection for Devnet
 */
export function createDevnetConnection(): Connection {
  return new Connection(DEVNET_RPC_URL, 'confirmed');
}

/**
 * Get the Devnet RPC URL (for logging/debugging - redacts secrets)
 */
export function getDevnetRpcUrl(): string {
  // Redact any API keys in the URL for safe logging
  const url = new URL(DEVNET_RPC_URL);
  if (url.searchParams.has('api-key')) {
    url.searchParams.set('api-key', '[REDACTED]');
  }
  return url.toString();
}