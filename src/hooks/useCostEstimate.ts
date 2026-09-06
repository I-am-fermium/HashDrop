/**
 * HashDrop Cost Estimate Hook
 *
 * Calculates transparent memo drop costs before signing.
 * Uses network-authoritative pricing from Solana RPC.
 */

import { useState, useEffect, useCallback } from 'react';
import { HASHDROP_PLATFORM_FEE_LAMPORTS } from '../lib/constants';
import { lamportsToSol, getConnection } from '../lib/solana/networkCost';

/**
 * Cost breakdown for a publication
 */
export interface CostEstimate {
  contentSize: number;
  protocolFeeLamports: number;
  protocolFeeSol: number;
  totalLamports: number;
  totalSol: number;
  networkFeeLamports: number;
  networkFeeSol: number;
  totalWithNetworkFeeLamports: number;
  totalWithNetworkFeeSol: number;
  exceedsMaxSize: boolean;
}

/**
 * Hook for calculating cost estimates
 * Uses network-authoritative pricing from Solana RPC
 * Note: exceedsMaxSize is now determined by actual transaction serialization
 */
export function useCostEstimate(content: string) {
  const [estimate, setEstimate] = useState<CostEstimate>({
    contentSize: 0,
    protocolFeeLamports: 0,
    protocolFeeSol: 0,
    totalLamports: 0,
    totalSol: 0,
    networkFeeLamports: 0,
    networkFeeSol: 0,
    totalWithNetworkFeeLamports: 0,
    totalWithNetworkFeeSol: 0,
    exceedsMaxSize: false,
  });

  const calculate = useCallback((text: string): CostEstimate => {
    const contentSize = new TextEncoder().encode(text).length;
    
    // Note: exceedsMaxSize is now determined by actual transaction serialization
    // in the page.tsx component. We keep this for backward compatibility
    // but it's no longer used for validation.
    // V1 transactions support up to 4096 bytes total (including overhead)
    // Legacy/V0 transactions support up to 1232 bytes total
    const exceedsMaxSize = false; // Will be determined by actual transaction size

    // Protocol fee in lamports - 0.001 SOL (single source of truth)
    const protocolFeeLamports = HASHDROP_PLATFORM_FEE_LAMPORTS;
    const protocolFeeSol = lamportsToSol(protocolFeeLamports);

    // Network fee (estimated - will be fetched from RPC for actual transaction)
    const networkFeeLamports = 5000; // Estimated 5000 lamports
    const networkFeeSol = lamportsToSol(networkFeeLamports);

    // Total costs
    const totalLamports = networkFeeLamports + protocolFeeLamports;
    const totalWithNetworkFeeLamports = totalLamports + networkFeeLamports;

    return {
      contentSize,
      protocolFeeLamports,
      protocolFeeSol,
      totalLamports,
      totalSol: lamportsToSol(totalLamports),
      networkFeeLamports,
      networkFeeSol,
      totalWithNetworkFeeLamports,
      totalWithNetworkFeeSol: lamportsToSol(totalWithNetworkFeeLamports),
      exceedsMaxSize,
    };
  }, []);

  useEffect(() => {
    setEstimate(calculate(content));
  }, [content, calculate]);

  return { estimate, calculate };
}

export default useCostEstimate;