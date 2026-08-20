/**
 * HashDrop Network Configuration
 * 
 * SINGLE SOURCE OF TRUTH for network configuration.
 * Centralizes all network-dependent operations.
 */

// Default RPC endpoints (can be overridden via environment variables)
export const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';
export const DEFAULT_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

// Get RPC endpoint from environment or use default
export const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC || DEFAULT_DEVNET_RPC;
export const MAINNET_RPC = process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC || DEFAULT_MAINNET_RPC;

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

// Single source of truth for network configurations
export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
  devnet: {
    network: 'devnet',
    cluster: 'devnet',
    rpcUrl: DEVNET_RPC,
    explorerUrl: (signature: string) => `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    explorerLabel: 'devnet',
  },
  mainnet: {
    network: 'mainnet',
    cluster: 'mainnet-beta',
    rpcUrl: MAINNET_RPC,
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
 */
export function getRpcUrl(): string {
  return getNetworkConfig().rpcUrl;
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
 */
export function getNetworkDisplay(): string {
  if (typeof window === 'undefined') {
    return 'Devnet';
  }
  const config = getNetworkConfig();
  return config.network === 'mainnet' 
    ? 'Mainnet (Beta)' 
    : 'Devnet';
}