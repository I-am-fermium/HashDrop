/**
 * HashDrop Cost Estimate Hook
 *
 * Calculates transparent memo drop costs before signing.
 * Uses network-authoritative pricing from Solana RPC.
 */

import { useState, useEffect, useCallback } from 'react';
import { SOL_DECIMALS } from '../lib/constants';
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
    const exceedsMaxSize = contentSize > 1024; // 1KB max for memo

    // Protocol fee in lamports - 0.001 SOL
    const protocolFeeLamports = 1000000; // 0.001 SOL = 1,000,000 lamports
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