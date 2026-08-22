/**
 * HashDrop Mainnet RPC Configuration
 * 
 * Provides network-specific RPC configuration for Mainnet.
 * Uses environment variable NEXT_PUBLIC_SOLANA_MAINNET_RPC.
 * 
 * IMPORTANT: This file requires NEXT_PUBLIC_SOLANA_MAINNET_RPC to be set.
 * The application will fail with a clear error if not configured.
 * 
 * Do NOT fall back to the public Solana Mainnet RPC.
 * 
 * Configure your Helius RPC URL in .env.local:
 * NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
 */

import { createSolanaRpc } from '@solana/rpc';
import type { Rpc } from '@solana/rpc-spec';
import type { SolanaRpcApi } from '@solana/rpc-api';
import { Connection } from '@solana/web3.js';

// Get Mainnet RPC URL from environment
const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC;

// Diagnostic logging for RPC configuration
function logRpcDiagnostics(): void {
  if (!MAINNET_RPC_URL) {
    console.error('[HashDrop] CRITICAL: NEXT_PUBLIC_SOLANA_MAINNET_RPC is not configured!');
    console.error('[HashDrop] Please set NEXT_PUBLIC_SOLANA_MAINNET_RPC in your .env.local file.');
    console.error('[HashDrop] Example: NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY');
    return;
  }

  try {
    const url = new URL(MAINNET_RPC_URL);
    const hostname = url.hostname;
    const hasApiKey = url.searchParams.has('api-key');
    const apiKey = url.searchParams.get('api-key') || '';
    
    console.log('[HashDrop] Network: mainnet');
    console.log('[HashDrop] RPC configured: true');
    console.log('[HashDrop] RPC hostname:', hostname);
    console.log('[HashDrop] API key present:', hasApiKey);
    console.log('[HashDrop] API key length:', apiKey.length);
    if (hasApiKey && apiKey.length > 8) {
      console.log('[HashDrop] API key preview:', apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4));
    }
  } catch (e) {
    console.error('[HashDrop] Invalid RPC URL format:', e);
  }
}

// Log diagnostics
logRpcDiagnostics();

/**
 * Create a Solana Kit RPC instance for Mainnet
 * Throws an error if NEXT_PUBLIC_SOLANA_MAINNET_RPC is not configured
 */
export function createMainnetRpc(): Rpc<SolanaRpcApi> {
  if (!MAINNET_RPC_URL) {
    throw new Error(
      'Mainnet RPC is not configured. ' +
      'Set NEXT_PUBLIC_SOLANA_MAINNET_RPC in your .env.local file. ' +
      'Example: NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY'
    );
  }
  return createSolanaRpc(MAINNET_RPC_URL);
}

/**
 * Create a web3.js Connection for Mainnet
 * Throws an error if NEXT_PUBLIC_SOLANA_MAINNET_RPC is not configured
 */
export function createMainnetConnection(): Connection {
  if (!MAINNET_RPC_URL) {
    throw new Error(
      'Mainnet RPC is not configured. ' +
      'Set NEXT_PUBLIC_SOLANA_MAINNET_RPC in your .env.local file. ' +
      'Example: NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY'
    );
  }
  return new Connection(MAINNET_RPC_URL, 'confirmed');
}

/**
 * Get the Mainnet RPC URL (for logging/debugging - redacts secrets)
 */
export function getMainnetRpcUrl(): string {
  if (!MAINNET_RPC_URL) {
    return 'NOT CONFIGURED';
  }
  // Redact any API keys in the URL for safe logging
  try {
    const url = new URL(MAINNET_RPC_URL);
    if (url.searchParams.has('api-key')) {
      url.searchParams.set('api-key', '[REDACTED]');
    }
    return url.toString();
  } catch {
    return 'INVALID URL';
  }
}

/**
 * Check if Mainnet RPC is configured
 */
export function isMainnetRpcConfigured(): boolean {
  return !!MAINNET_RPC_URL;
}