/**
 * HashDrop Wallet Hook (Solana Kit)
 * 
 * Provides wallet connection and transaction utilities.
 * Uses Wallet Standard for wallet discovery and connection.
 * 
 * NOTE: This is a hybrid implementation.
 * - Uses Address type strings for wallet state (Kit-compatible)
 * - Uses legacy web3.js Connection/transaction for wallet signing (Phantom compatibility)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

import { getRpcUrl, getCurrentNetwork, setCurrentNetwork, Network, getNetworkConfig, createConnection, getRpcUrlForLogging } from '../lib/network';
import { getConnection } from '../lib/solana/networkCost';

// Network configuration
export const GET_CURRENT_ENDPOINT = (): string => {
  return getRpcUrl();
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
  network: Network;
  connection: Connection | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<TransactionResult>;
  wallet: any;
  setNetwork: (network: Network) => void;
}

/**
 * Hook for wallet operations
 * Compatible with Phantom and other Wallet Standard wallets
 */
export function useWalletKit(): UseWalletResult {
  const [network, setNetworkState] = useState<Network>(getCurrentNetwork());
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const walletRef = useRef<any>(null);

  // Initialize connection and network
  useEffect(() => {
    const currentNetwork = getCurrentNetwork();
    const conn = createConnection();
    console.log('[HashDrop] Connection initialized:', {
      network: currentNetwork,
      rpc: getRpcUrlForLogging(),
    });
    setConnection(conn);
    setNetworkState(currentNetwork);
  }, []);

  // Handle network changes - update connection when network changes
  useEffect(() => {
    const conn = createConnection();
    console.log('[HashDrop] Network changed, updating connection:', {
      oldNetwork: network,
      newNetwork: getCurrentNetwork(),
      rpc: getRpcUrlForLogging(),
    });
    setConnection(conn);
  }, [network]);

  // Check wallet connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkConnectionStatus = () => {
      try {
        // Check for Phantom wallet (Wallet Standard)
        const walletRegistry = (window as any).solana;
        if (walletRegistry) {
          // Phantom stores wallet status internally
          if (walletRegistry.isConnected) {
            const storedPk = localStorage.getItem('phantom-key');
            if (storedPk) {
              setPublicKey(storedPk);
              setIsConnected(true);
            } else {
              // Try to get public key from provider
              try {
                const pkStr = walletRegistry.publicKey?.toBase58();
                if (pkStr) {
                  setPublicKey(pkStr);
                  setIsConnected(true);
                }
              } catch {
                // Not connected
              }
            }
          }
        }
      } catch {
        // Not connected
      }
    };

    checkConnectionStatus();
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const walletRegistry = (window as any).solana;
    if (!walletRegistry) {
      throw new Error('No wallet detected. Please install Phantom or another Wallet Standard wallet.');
    }

    try {
      const accounts = await walletRegistry.connect();
      if (accounts && accounts.publicKey) {
        const pubKeyStr = accounts.publicKey.toString();
        setPublicKey(pubKeyStr);
        setIsConnected(true);
        setWallet(walletRegistry);
        walletRef.current = walletRegistry;

        console.log('[HashDrop] Wallet connected:', {
          publicKey: pubKeyStr,
          network: network,
          rpc: getRpcUrlForLogging(),
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

    const walletRegistry = walletRef.current || (window as any).solana;
    if (walletRegistry) {
      try {
        await walletRegistry.disconnect();
        console.log('[HashDrop] Phantom disconnect called');
      } catch (error: any) {
        console.error('[HashDrop] Disconnect failed:', error);
      } finally {
        setPublicKey(null);
        setIsConnected(false);
        setWallet(null);
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
      setPublicKey(null);
      setIsConnected(false);
      setWallet(null);
      walletRef.current = null;
    }
  }, []);

  // Set network (with wallet reconnection if needed)
  const setNetwork = useCallback((newNetwork: Network) => {
    const currentNetwork = getCurrentNetwork();
    
    if (currentNetwork !== newNetwork) {
      // Network is changing
      console.log('[HashDrop] Network changing:', currentNetwork, '->', newNetwork);
      
      // Disconnect current wallet if connected
      if (isConnected) {
        disconnect();
      }
      
      // Update network state
      setCurrentNetwork(newNetwork);
      setNetworkState(newNetwork);
      
      // Reconnect wallet if it was connected
      if (walletRef.current) {
        // Wallet will reconnect on next connect call
      }
    }
  }, [isConnected, disconnect]);

  // Send transaction using the wallet's native API
  const sendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
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

    const walletRegistry = walletRef.current || (window as any).solana;
    if (!walletRegistry) {
      return {
        success: false,
        signature: null,
        error: 'No wallet provider available. Please connect your wallet.',
        blockTime: null,
      };
    }

    try {
      const conn = connection || createConnection();

      // Validate transaction
      if (!transaction) {
        return {
          success: false,
          signature: null,
          error: 'Transaction is null',
          blockTime: null,
        };
      }

      console.log('[HashDrop] Sending transaction:', {
        publicKey,
        network: getCurrentNetwork(),
        rpc: getRpcUrlForLogging(),
      });

      // Sign transaction with wallet
      const signedTransaction = await walletRegistry.signTransaction(transaction);
      const signature = await conn.sendRawTransaction(signedTransaction.serialize());

      console.log('[HashDrop] Transaction sent:', signature);

      // Confirm transaction
      await conn.confirmTransaction(signature, 'confirmed');
      console.log('[HashDrop] Transaction confirmed');

      return {
        success: true,
        signature,
        error: null,
        blockTime: null,
      };
    } catch (error: any) {
      console.error('[HashDrop] Wallet transaction error:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });

      // Handle RPC errors (403, etc.)
      if (error?.code === 403 || error?.message?.includes('403')) {
        return {
          success: false,
          signature: null,
          error: `RPC Access forbidden (403). Check your Mainnet RPC configuration. The configured RPC endpoint rejected the request. You may need to set NEXT_PUBLIC_SOLANA_MAINNET_RPC in your .env.local file with a valid RPC provider URL.`,
          blockTime: null,
        };
      }

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
    wallet,
    setNetwork,
  };
}

export default useWalletKit;