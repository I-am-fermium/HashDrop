/**
 * HashDrop Network Configuration
 * 
 * SINGLE SOURCE OF TRUTH for network configuration.
 * Centralizes all network-dependent operations.
 */

import { Connection } from '@solana/web3.js';
import type { Rpc } from '@solana/rpc-spec';
import type { SolanaRpcApi } from '@solana/rpc-api';

// Import network-specific RPC configurations
import { createDevnetRpc, createDevnetConnection, getDevnetRpcUrl, DEVNET_RPC_URL } from './rpc/devnet';
import { createMainnetRpc, createMainnetConnection, getMainnetRpcUrl, getMainnetRpcEndpoint, isMainnetRpcConfigured } from './rpc/mainnet';

// Network type
export type Network = 'devnet' | 'mainnet';

// Network configuration interface
export interface NetworkConfig {
  network: Network;
  cluster: 'devnet' | 'mainnet-beta';
  rpcUrl: string;
  explorerUrl: (signature: string) => string;
  explorerLabel: string;
}

// Export RPC URLs for backward compatibility (used by constants.ts)
export const DEVNET_RPC = DEVNET_RPC_URL;
// The Mainnet ENDPOINT (raw, API key included) — never the redacted logging form.
export const MAINNET_RPC = getMainnetRpcEndpoint();

// Single source of truth for network configurations
export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  devnet: {
    network: 'devnet',
    cluster: 'devnet',
    rpcUrl: DEVNET_RPC_URL,
    explorerUrl: (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    explorerLabel: 'devnet',
  },
  mainnet: {
    network: 'mainnet',
    cluster: 'mainnet-beta',
    rpcUrl: getMainnetRpcEndpoint(),
    explorerUrl: (signature: string) => `https://explorer.solana.com/tx/${signature}`,
    explorerLabel: 'mainnet-beta',
  },
};

/**
 * Get current network from localStorage or URL parameter
 * Falls back to devnet if not set
 * Note: This is SSR-safe - returns 'devnet' on server
 */
export function getCurrentNetwork(): Network {
  if (typeof window === 'undefined') {
    return 'devnet';
  }
  
  // Check localStorage first (persistent setting)
  const storedNetwork = localStorage.getItem('hashdrop-network');
  if (storedNetwork === 'mainnet' || storedNetwork === 'devnet') {
    return storedNetwork;
  }
  
  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlNetwork = urlParams.get('network');
  if (urlNetwork === 'mainnet') {
    return 'mainnet';
  }
  
  // Default to devnet
  return 'devnet';
}

/**
 * Set the current network (persists to localStorage)
 */
export function setCurrentNetwork(network: Network): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('hashdrop-network', network);
}

/**
 * Get the configuration for the current network
 */
export function getNetworkConfig(): NetworkConfig {
  const network = getCurrentNetwork();
  return NETWORK_CONFIGS[network];
}

/**
 * Get the RPC URL for the current network
 *
 * Devnet uses NEXT_PUBLIC_SOLANA_DEVNET_RPC when configured and otherwise
 * falls back to the public Solana Devnet endpoint. `DEVNET_RPC_URL`
 * (./rpc/devnet.ts) is the SINGLE source of truth for that value: this function
 * must never hard-code an endpoint again, because every devnet read (including
 * Retrieve's getTransaction) and every devnet write resolves its endpoint here
 * or through createConnection()/createRpc(). Hard-coding bypassed the
 * configured provider for those paths — the cause of Retrieve hanging on an
 * unresponsive public Devnet RPC.
 */
export function getRpcUrl(): string {
  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    if (!isMainnetRpcConfigured()) {
      throw new Error(
        'Mainnet RPC is not configured. ' +
        'Set NEXT_PUBLIC_SOLANA_MAINNET_RPC in your .env.local file. ' +
        'Example: NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY'
      );
    }
    return getMainnetRpcEndpoint();
  }
  // Devnet: NEXT_PUBLIC_SOLANA_DEVNET_RPC when set, public Devnet otherwise.
  return DEVNET_RPC_URL;
}

/**
 * Get the explorer URL for a transaction signature
 */
export function getExplorerUrl(signature: string): string {
  return getNetworkConfig().explorerUrl(signature);
}

/**
 * Check if the current network is mainnet
 * Note: SSR-safe - returns false on server
 */
export function isMainnet(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return getCurrentNetwork() === 'mainnet';
}

/**
 * Check if the current network is devnet
 */
export function isDevnet(): boolean {
  return getCurrentNetwork() === 'devnet';
}

/**
 * Get network display label
 * Note: SSR-safe - returns 'Devnet' on server
 */
export function getNetworkLabel(): string {
  if (typeof window === 'undefined') {
    return 'Devnet';
  }
  const config = getNetworkConfig();
  return config.network === 'mainnet' ? 'Mainnet' : 'Devnet';
}

/**
 * Get network display label with cluster info
 * Note: SSR-safe - returns 'Devnet' on server
 *
 * @param network - Optional explicit network. Retrieve passes the network of the
 *   Connection it actually queried so the label always describes the cluster
 *   that was used, never a separately-read selection.
 */
export function getNetworkDisplay(network?: Network): string {
  const selected = network ?? (typeof window === 'undefined' ? 'devnet' : getCurrentNetwork());
  return selected === 'mainnet' ? 'Mainnet (Beta)' : 'Devnet';
}

/**
 * Identify which configured cluster an RPC endpoint belongs to.
 *
 * Retrieve derives its diagnostics from the Connection it actually used, so a
 * read can never be reported against the wrong cluster. The comparison ignores
 * query strings (API keys are redacted in NETWORK_CONFIGS) and tolerates a
 * trailing slash; an ambiguous or unknown endpoint returns null so callers can
 * fall back to their previous behaviour.
 */
export function getNetworkForRpcEndpoint(endpoint: string): Network | null {
  if (!endpoint || typeof endpoint !== 'string') {
    return null;
  }

  const normalize = (value: string): string => {
    try {
      const url = new URL(value);
      const path = url.pathname.replace(/\/+$/, '');
      return `${url.origin}${path}`;
    } catch {
      return value.trim();
    }
  };

  const target = normalize(endpoint);
  const matches: Network[] = [];

  (['mainnet', 'devnet'] as Network[]).forEach((network) => {
    const configured = NETWORK_CONFIGS[network]?.rpcUrl;
    if (configured && normalize(configured) === target) {
      matches.push(network);
    }
  });

  return matches.length === 1 ? matches[0] : null;
}

/**
 * Network of the Connection used for an RPC read (null when the endpoint is not
 * one of the configured cluster endpoints, e.g. a test double).
 */
export function getNetworkForConnection(connection: unknown): Network | null {
  const endpoint = (connection as { rpcEndpoint?: unknown } | null | undefined)?.rpcEndpoint;
  return typeof endpoint === 'string' ? getNetworkForRpcEndpoint(endpoint) : null;
}

/**
 * Create a Connection for the current network
 * This is the preferred way to get a web3.js Connection
 */
export function createConnection(): Connection {
  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    return createMainnetConnection();
  }
  return createDevnetConnection();
}

/**
 * Create a Solana Kit RPC instance for the current network
 * This is the preferred way to get a Kit RPC instance
 */
export function createRpc(): Rpc<SolanaRpcApi> {
  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    return createMainnetRpc();
  }
  return createDevnetRpc();
}

/**
 * Get the RPC URL for the current network (for logging/debugging)
 * Redacts any API keys for safe logging
 */
export function getRpcUrlForLogging(): string {
  const network = getCurrentNetwork();
  if (network === 'mainnet') {
    return getMainnetRpcUrl();
  }
  return getDevnetRpcUrl();
}