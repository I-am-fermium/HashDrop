/**
 * HashDrop Wallet Provider
 *
 * Wraps the app with Solana wallet adapter context.
 */

'use client';

import { ReactNode, useMemo } from 'react';
import {
  WalletProvider,
} from '@solana/wallet-adapter-react';

interface HashDropWalletProviderProps {
  children: ReactNode;
}

export default function HashDropWalletProvider({
  children,
}: HashDropWalletProviderProps) {
  // Empty wallets array - wallets will be detected automatically
  const wallets = useMemo(() => [], []);

  return (
    <WalletProvider wallets={wallets} autoConnect>
      {children}
    </WalletProvider>
  );
}