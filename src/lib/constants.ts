/**
 * HashDrop Constants
 * Configuration for Solana program and network settings
 */

// Re-export network configuration from centralized source
export { 
  DEVNET_RPC as DEVNET_ENDPOINT, 
  MAINNET_RPC as MAINNET_ENDPOINT,
  getCurrentNetwork as getNetwork,
  NETWORK_CONFIGS,
  getNetworkConfig,
  getRpcUrl,
  getExplorerUrl,
  isMainnet,
  isDevnet,
  getNetworkLabel,
  getNetworkDisplay,
} from './network';

// Re-export types
export type { Network, NetworkConfig } from './network';

// Default network endpoint (for backward compatibility)
export const DEFAULT_DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
export const DEFAULT_MAINNET_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Get current endpoint from URL parameter or default to devnet
// DEPRECATED: Use getRpcUrl() from network.ts instead
export const getEndpoint = (): string => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('network') === 'mainnet' ? DEFAULT_MAINNET_ENDPOINT : DEFAULT_DEVNET_ENDPOINT;
  }
  return DEFAULT_DEVNET_ENDPOINT;
};

// Content constraints - removed hardcoded 1024-byte limit
// Transaction size is now dynamically validated based on actual serialized transaction size
// V1 transactions support up to 4096 bytes
// Legacy/V0 transactions support up to 1232 bytes

// Protocol configuration
export const HASHDROP_VERSION = 1;

// Token decimals for SOL
export const SOL_DECIMALS = 9;

// Platform (protocol) fee — single source of truth.
// The publish transaction transfers 0.001 SOL (1,000,000 lamports) from the
// user's wallet to HASHDROP_FEE_WALLET via a SystemProgram.transfer instruction
// (see src/lib/transactions.ts: buildV1Transaction).
export const HASHDROP_PLATFORM_FEE_LAMPORTS = 1_000_000;
export const HASHDROP_PLATFORM_FEE_SOL = HASHDROP_PLATFORM_FEE_LAMPORTS / Math.pow(10, SOL_DECIMALS);

// Public receiving wallet for the HashDrop platform fee (NOT a secret, no key material).
export const HASHDROP_FEE_WALLET = 'Amy4Tej83vsnCdFbBtfWmQrEdRLVF4AVAvZupyka8qQT';