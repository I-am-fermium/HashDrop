/**
 * HashDrop Constants
 * Configuration for Solana program and network settings
 */

// Network configuration
export const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
export const MAINNET_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Get current endpoint from URL parameter or default to devnet
export const getEndpoint = (): string => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('network') === 'mainnet' ? MAINNET_ENDPOINT : DEVNET_ENDPOINT;
  }
  return DEVNET_ENDPOINT;
};

// Content constraints
export const MAX_CONTENT_SIZE_FOR_MEMO = 1024; // 1KB max for Memo Drop

// Protocol configuration
export const HASHDROP_VERSION = 1;
export const PROTOCOL_FEE = 0.001; // Example fee, to be configured by human owner

// Token decimals for SOL
export const SOL_DECIMALS = 9;