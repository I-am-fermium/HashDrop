/**
 * HashDrop Wallet Hook
 * 
 * Provides wallet connection and transaction utilities using Solana Kit
 * Uses Wallet Standard for wallet interactions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey, VersionedTransaction, Connection } from '@solana/web3.js';
import { createSolanaRpc } from '@solana/rpc';
import type { Rpc } from '@solana/rpc-spec';
import type { SolanaRpcApi } from '@solana/rpc-api';

import { DEVNET_ENDPOINT, MAINNET_ENDPOINT } from '../lib/constants';

// Network configuration
export const GET_CURRENT_ENDPOINT = (): string => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('network') === 'mainnet' ? MAINNET_ENDPOINT : DEVNET_ENDPOINT;
  }
  return DEVNET_ENDPOINT;
};

// Transaction result
export interface TransactionResult {
  success: boolean;
  signature: string | null;
  error: string | null;
  blockTime: number | null;
}

export interface UseWalletResult {
  publicKey: string | null;
  isConnected: boolean;
  network: 'devnet' | 'mainnet';
  connection: Connection | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: VersionedTransaction) => Promise<TransactionResult>;
  wallet: any;
}

/**
 * Get RPC connection using Solana Kit
 */
export function getConnection(): Connection {
  const endpoint = GET_CURRENT_ENDPOINT();
  return new Connection(endpoint, 'confirmed');
}

/**
 * Hook for wallet operations - uses direct window.solana API
 * Compatible with Phantom and Brave browsers
 * Uses Solana Kit for RPC operations
 */
export function useWallet(): UseWalletResult {
  const [network, setNetwork] = useState<'devnet' | 'mainnet'>('devnet');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const walletRef = useRef<any>(null);

  // Initialize connection and network
  useEffect(() => {
    const conn = getConnection();
    setConnection(conn);
    const currentNetwork = GET_CURRENT_ENDPOINT().includes('devnet') ? 'devnet' : 'mainnet';
    setNetwork(currentNetwork);
  }, []);

  // Detect wallet and connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const provider = (window as any).solana;
    if (!provider) return;

    // Store wallet reference for later use
    walletRef.current = provider;

    // Check if already connected by checking the wallet's internal state
    const checkConnectionStatus = () => {
      try {
        // Phantom stores wallet status internally
        if (provider.isConnected) {
          const storedPk = localStorage.getItem('phantom-key');
          if (storedPk) {
            setPublicKey(storedPk);
            setIsConnected(true);
          } else {
            // Try to get public key from provider
            try {
              const pkStr = provider.publicKey?.toBase58();
              if (pkStr) {
                setPublicKey(pkStr);
                setIsConnected(true);
              }
            } catch {
              // Not connected
            }
          }
        }
      } catch {
        // Not connected
      }
    };

    checkConnectionStatus();

    return () => {
      // Cleanup - nothing to clean up for Phantom
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const provider = (window as any).solana;
    if (!provider) {
      throw new Error('No wallet detected. Please install Phantom or Brave wallet.');
    }

    try {
      const accounts = await provider.connect();
      if (accounts && accounts.publicKey) {
        const pubKeyStr = accounts.publicKey.toBase58();
        setPublicKey(pubKeyStr);
        setIsConnected(true);
        walletRef.current = provider;

        console.log('[HashDrop] Wallet connected:', {
          publicKey: pubKeyStr,
          network: network,
        });
      } else {
        throw new Error('No public key returned from wallet');
      }
    } catch (error: any) {
      console.error('[HashDrop] Wallet connection failed:', error);
      throw error;
    }
  }, [network]);

  const disconnect = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const provider = walletRef.current || (window as any).solana;
    if (provider) {
      try {
        await provider.disconnect();
        console.log('[HashDrop] Phantom disconnect called');
      } catch (error: any) {
        console.error('[HashDrop] Disconnect failed:', error);
      } finally {
        // Clear state
        setPublicKey(null);
        setIsConnected(false);
        walletRef.current = null;
        
        // Clear localStorage key if present
        try {
          localStorage.removeItem('phantom-key');
        } catch {
          // Ignore if localStorage not available
        }
        
        console.log('[HashDrop] Wallet disconnected');
      }
    } else {
      // If no provider, just reset state
      setPublicKey(null);
      setIsConnected(false);
      walletRef.current = null;
    }
  }, []);

  // Send transaction using the wallet's native API (Phantom/Brave)
  // Supports VersionedTransaction for v1 transactions
  const sendTransaction = useCallback(async (
    transaction: VersionedTransaction
  ): Promise<TransactionResult> => {
    if (typeof window === 'undefined') {
      return {
        success: false,
        signature: null,
        error: 'Window not available',
        blockTime: null,
      };
    }

    if (!isConnected || !publicKey) {
      return {
        success: false,
        signature: null,
        error: 'Wallet not connected. Please connect your wallet first.',
        blockTime: null,
      };
    }

    const provider = walletRef.current || (window as any).solana;
    if (!provider) {
      return {
        success: false,
        signature: null,
        error: 'No wallet provider available. Please connect your wallet.',
        blockTime: null,
      };
    }

    try {
      const conn = connection || getConnection();

      // Validate transaction
      if (!transaction) {
        return {
          success: false,
          signature: null,
          error: 'Transaction is null',
          blockTime: null,
        };
      }

      // Check if it's a VersionedTransaction (v1 only)
      const isVersioned = transaction instanceof VersionedTransaction;
      
      if (isVersioned) {
        // For VersionedTransaction, we need to sign it first
        // Phantom/Brave wallets support signTransaction for VersionedTransaction
        if (provider.signTransaction) {
          const signedTx = await provider.signTransaction(transaction);
          const signature = await conn.sendRawTransaction(signedTx.serialize());
          console.log('[HashDrop] Transaction signed and sent:', signature);
          
          await conn.confirmTransaction(signature, 'confirmed');
          console.log('[HashDrop] Transaction confirmed');
          
          return {
            success: true,
            signature,
            error: null,
            blockTime: null,
          };
        } else {
          return {
            success: false,
            signature: null,
            error: 'Wallet does not support VersionedTransaction signing',
            blockTime: null,
          };
        }
      } else {
        return {
          success: false,
          signature: null,
          error: 'Only v1 transactions (VersionedTransaction) are supported. Legacy transactions are not supported.',
          blockTime: null,
        };
      }

    } catch (error: any) {
      console.error('[HashDrop] Wallet transaction error:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });

      // Handle user rejection
      if (error?.name === 'UserRejectedTransactionError' ||
          error?.message?.toLowerCase().includes('user rejected') ||
          error?.message?.toLowerCase().includes('rejected')) {
        return {
          success: false,
          signature: null,
          error: 'User rejected the transaction',
          blockTime: null,
        };
      }

      // Handle insufficient funds
      if (error?.message?.toLowerCase().includes('insufficient')) {
        return {
          success: false,
          signature: null,
          error: 'Insufficient funds for this transaction',
          blockTime: null,
        };
      }

      // Handle timeout
      if (error?.message?.toLowerCase().includes('timeout')) {
        return {
          success: false,
          signature: null,
          error: 'Transaction timeout - please try again',
          blockTime: null,
        };
      }

      return {
        success: false,
        signature: null,
        error: error?.message || 'Transaction failed',
        blockTime: null,
      };
    }
  }, [isConnected, publicKey, connection]);

  return {
    publicKey,
    isConnected,
    network,
    connection,
    connect,
    disconnect,
    sendTransaction,
    wallet: walletRef.current,
  };
}

export default useWallet;