'use client';

import { CostEstimate } from '../hooks/useCostEstimate';
import { HASHDROP_PLATFORM_FEE_SOL } from '../lib/constants';

interface CostSummaryProps {
  estimate: CostEstimate;
  method?: 'memo';
}

// Default network fee estimate (5000 lamports = 0.000005 SOL)
const DEFAULT_NETWORK_FEE_SOL = 0.000005;

export function CostSummary({ estimate, method = 'memo' }: CostSummaryProps) {
  // For Memo Drop - show simple cost breakdown.
  // The platform fee uses the shared constant so the displayed amount matches
  // the SystemProgram.transfer instruction encoded in the publish transaction.
  const total = HASHDROP_PLATFORM_FEE_SOL + DEFAULT_NETWORK_FEE_SOL;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-secondary">HashDrop Protocol Fee:</span>
        <span className="text-accent">{HASHDROP_PLATFORM_FEE_SOL.toFixed(6)} SOL</span>
      </div>
      <div className="flex justify-between">
        <span className="text-secondary">Solana Network Fee:</span>
        <span className="text-accent">{DEFAULT_NETWORK_FEE_SOL.toFixed(6)} SOL</span>
      </div>
      <div className="border-t border-gray-700 pt-2 flex justify-between font-bold">
        <span className="text-primary">Total:</span>
        <span className="text-accent">{total.toFixed(6)} SOL</span>
      </div>
      <div className="text-xs text-secondary mt-1">
        Memo Drop · transaction-based
      </div>
    </div>
  );
}