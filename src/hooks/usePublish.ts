/**
 * HashDrop Publish Hook
 * 
 * Provides publish functionality for Memo Drop only
 * Uses network-authoritative pricing from Solana RPC
 */

import { useState, useCallback } from 'react';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { processContent, ContentMeta } from '../lib/content';
import { DEVNET_ENDPOINT, HASHDROP_PLATFORM_FEE_LAMPORTS, HASHDROP_FEE_WALLET } from '../lib/constants';
import { encodePublicPayload, canFitInMemo, MEMO_PROGRAM_ID } from '../lib/memo';
import {
  getBaseTransactionFee,
  getConnection,
  lamportsToSol,
} from '../lib/solana/networkCost';
import {
  buildPublicTransaction,
  serializeTransaction,
  getTransactionSize,
  getMaxTransactionBytes,
  detectTransactionCapabilities,
} from '../lib/transactions';

export type PublishMethod = 'memo';

export interface PublishResult {
  success: boolean;
  signature: string | null;
  error: string | null;
  method: PublishMethod;
  hashDropId: string;
  contentHash: string;
  transactionVersion?: string;
  transactionSize?: number;
  maxTransactionSize?: number;
}

// Transaction result interface
export interface TransactionResult {
  success: boolean;
  signature: string | null;
  error: string | null;
  blockTime: number | null;
}

// Protocol fee (single source of truth in src/lib/constants.ts)
// NOTE: This hook is currently dead code (not imported by any page). The active
// publish path lives in src/app/page.tsx + src/lib/transactions.ts. It is kept
// consistent with the active path so the platform fee is always encoded if this
// hook is ever reactivated.

// Helper function to get connection (avoids circular import)
function getConnectionLocal(): Connection {
  return new Connection(DEVNET_ENDPOINT, 'confirmed');
}

/**
 * Timeout wrapper for async operations
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(timeoutError)), ms)
    ),
  ]);
}

export function usePublish() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<PublishResult | null>(null);

  /**
   * Get the actual available space for content based on transaction serialization
   * This is the key function for dynamic size validation
   */
  const getAvailableContentSpace = useCallback(async (
    content: string,
    publicKey: PublicKey,
    connection?: Connection
  ): Promise<{
    availableBytes: number;
    transactionSize: number;
    maxTransactionBytes: number;
    version: string;
  }> => {
    const conn = connection || getConnectionLocal();
    
    // Get capabilities
    const capabilities = await detectTransactionCapabilities(conn);
    
    // Build a test transaction to get actual size
    const base64Content = btoa(content);
    const hashDropId = `hd_test_${Date.now()}`;
    const contentHash = '0'.repeat(64); // Placeholder
    
    const memoPayload = encodePublicPayload(
      hashDropId,
      contentHash,
      'text/plain',
      content.length,
      base64Content
    );
    
    // Get latest blockhash
    const { blockhash } = await conn.getLatestBlockhash();
    
    // Build transaction
    const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);
    const memoInstruction = new TransactionInstruction({
      programId: memoProgramId,
      data: Buffer.from(memoPayload, 'utf-8'),
      keys: [],
    });
    
    const transactionMessage = new (require('@solana/web3.js').TransactionMessage)({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: [memoInstruction],
    });
    
    const v0Message = transactionMessage.compileToV0Message();
    const transaction = new (require('@solana/web3.js').VersionedTransaction)(v0Message);
    
    // Serialize and get actual size
    const serialized = serializeTransaction(transaction);
    const transactionSize = serialized.length;
    
    const maxTransactionBytes = getMaxTransactionBytes(capabilities);
    const availableBytes = maxTransactionBytes - transactionSize;
    
    return {
      availableBytes,
      transactionSize,
      maxTransactionBytes,
      version: capabilities.preferredVersion,
    };
  }, []);

  /**
   * Get estimated fees for Memo Drop using network-authoritative pricing
   */
    const getMemoDropFees = useCallback(async (connection?: Connection): Promise<{
    baseFee: number;
    protocolFee: number;
    total: number;
  }> => {
    try {
      const baseFee = await getBaseTransactionFee();
      return {
        baseFee,
        protocolFee: HASHDROP_PLATFORM_FEE_LAMPORTS,
        total: baseFee + HASHDROP_PLATFORM_FEE_LAMPORTS,
      };
    } catch {
      return {
        baseFee: 5000,
        protocolFee: HASHDROP_PLATFORM_FEE_LAMPORTS,
        total: 5000 + HASHDROP_PLATFORM_FEE_LAMPORTS,
      };
    }
  }, []);

  /**
   * Get recommended method (now always 'memo')
   */
  const getRecommendedMethod = useCallback((): 'memo' => {
    return 'memo';
  }, []);

  /**
   * Publish content using Memo Drop only
   * Uses dynamic transaction size validation
   */
  const publishMemoDrop = useCallback(async (
    content: string,
    publicKey: PublicKey,
    signTransactionFn: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<PublishResult> => {
    try {
      setIsPublishing(true);
      setProgress(20);
      
      // Process content
      const meta: ContentMeta = await processContent(content, publicKey.toBase58());
      
      setProgress(40);
      
      // Build transaction
      const connection = getConnectionLocal();
      const { blockhash } = await connection.getLatestBlockhash();
      
      // Encode content as base64 for V3 Public format
      const base64Content = btoa(content);

      // Encode public payload
      const memoPayload = encodePublicPayload(
        meta.hashDropId,
        meta.hash,
        'text/plain',
        meta.size,
        base64Content
      );
      
      // Build transaction using v0 format (kept consistent with the active path)
      const memoProgramId = new PublicKey(MEMO_PROGRAM_ID);
      const memoInstruction = new TransactionInstruction({
        programId: memoProgramId,
        data: Buffer.from(memoPayload, 'utf-8'),
        keys: [],
      });

      // HashDrop platform fee: transfer 0.001 SOL to the HashDrop fee wallet.
      // The user's wallet is the fee payer and the ONLY signer.
      const transferIx = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(HASHDROP_FEE_WALLET),
        lamports: HASHDROP_PLATFORM_FEE_LAMPORTS,
      });
      
      // Create TransactionMessage and compile to v0
      const { TransactionMessage } = require('@solana/web3.js');
      const transactionMessage = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [transferIx, memoInstruction],
      });
      
      const v0Message = transactionMessage.compileToV0Message();
      const transaction = new VersionedTransaction(v0Message);
      
      // Serialize and check actual size
      const serialized = serializeTransaction(transaction);
      const transactionSize = serialized.length;
      
      // Get capabilities
      const capabilities = await detectTransactionCapabilities(connection);
      const maxTransactionBytes = getMaxTransactionBytes(capabilities);
      
      console.log('[HashDrop] Transaction size validation:', {
        transactionSize,
        maxTransactionBytes,
        version: capabilities.preferredVersion,
        availableBytes: maxTransactionBytes - transactionSize,
      });
      
      // Validate transaction size
      if (transactionSize > maxTransactionBytes) {
        return {
          success: false,
          signature: null,
          error: `Transaction size (${transactionSize} bytes) exceeds maximum (${maxTransactionBytes} bytes) for ${capabilities.preferredVersion} transactions. Content too large for HashDrop Memo Drop.`,
          method: 'memo',
          hashDropId: meta.hashDropId,
          contentHash: meta.hash,
          transactionVersion: capabilities.preferredVersion,
          transactionSize,
          maxTransactionSize: maxTransactionBytes,
        };
      }
      
      setProgress(60);
      
      // Sign and send
      const signedTransaction = await signTransactionFn(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      
      setProgress(100);
      
      return {
        success: true,
        signature,
        error: null,
        method: 'memo',
        hashDropId: meta.hashDropId,
        contentHash: meta.hash,
        transactionVersion: capabilities.preferredVersion,
        transactionSize,
        maxTransactionSize: maxTransactionBytes,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        signature: null,
        error: error.message,
        method: 'memo',
        hashDropId: '',
        contentHash: '',
      };
    } finally {
      setIsPublishing(false);
      setProgress(0);
    }
  }, []);

  /**
   * Publish content using the recommended method (memo only)
   */
  const publish = useCallback(async (
    content: string,
    publicKey: PublicKey,
    signTransactionFn: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  ): Promise<PublishResult> => {
    return publishMemoDrop(content, publicKey, signTransactionFn);
  }, [publishMemoDrop]);

  /**
   * Get network fees
   */
  const getNetworkFees = useCallback(async (connection?: Connection) => {
    return getMemoDropFees(connection);
  }, [getMemoDropFees]);

  /**
   * Reset the publish state
   */
  const reset = useCallback(() => {
    setIsPublishing(false);
    setProgress(0);
    setResult(null);
  }, []);

  return {
    isPublishing,
    progress,
    result,
    publish,
    publishMemoDrop,
    getMemoDropFees,
    getRecommendedMethod,
    canFitInMemo,
    getNetworkFees,
    getAvailableContentSpace,
    reset,
  };
}

export default usePublish;