'use client';

import { useState, useEffect, useCallback } from 'react';
import { Transaction, PublicKey, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';

import { useWallet, TransactionResult, getConnection } from '../hooks/useWallet';
import { useCostEstimate } from '../hooks/useCostEstimate';
import { processContent, ContentMeta } from '../lib/content';
import { encodeMemoPayload, canFitInMemo, MEMO_PROGRAM_ID, calculateTransactionSize, LEGACY_TRANSACTION_MAX_BYTES, V1_TRANSACTION_MAX_BYTES } from '../lib/memo';
import { detectTransactionCapabilities, buildMemoDropTransaction, serializeTransaction } from '../lib/transactions';

import { WalletConnect } from '../components/WalletConnect';
import { PublishButton } from '../components/PublishButton';
import { CostSummary } from '../components/CostSummary';
import { ContentEditor } from '../components/ContentEditor';

// Default network fee for memo drop (5000 lamports)
const DEFAULT_NETWORK_FEE_SOL = 0.000005;

export default function Home() {
  const [content, setContent] = useState('Hello, HashDrop!');
  const [contentMeta, setContentMeta] = useState<ContentMeta | null>(null);
  const [publishProgress, setPublishProgress] = useState<number>(0);
  const [lastResult, setLastResult] = useState<TransactionResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [transactionInfo, setTransactionInfo] = useState<{
    transactionSize: number;
    maxTransactionSize: number;
    version: string;
    availableBytes: number;
  } | null>(null);
  const [capabilities, setCapabilities] = useState<{
    supportsV1: boolean;
    maxTransactionBytes: number;
    preferredVersion: string;
  } | null>(null);

  const { isConnected, publicKey, connect, disconnect, sendTransaction, network } = useWallet();
  const { estimate, calculate } = useCostEstimate(content);

  // Process content when it changes
  useEffect(() => {
    const processContentData = async () => {
      if (content && content.length > 0) {
        try {
const meta = await processContent(content, publicKey || 'pending');
          setContentMeta(meta);

          console.log('[HashDrop] Content processed:', {
            size: meta.size,
            hash: meta.hash,
            hashDropId: meta.hashDropId,
          });
        } catch (error) {
          console.error('[HashDrop] Content processing failed:', error);
        }
      } else {
        setContentMeta(null);
      }
    };
    processContentData();
  }, [content, publicKey]);

  // Calculate transaction size info and capabilities
  useEffect(() => {
    const calculateInfo = async () => {
      if (content && publicKey) {
        try {
          // Get transaction capabilities
          const caps = await detectTransactionCapabilities(getConnection());
          setCapabilities({
            supportsV1: caps.supportsV1,
            maxTransactionBytes: caps.maxTransactionBytes,
            preferredVersion: caps.preferredVersion,
          });
          
          // Calculate transaction size
          const info = calculateTransactionSize(content);
          setTransactionInfo({
            transactionSize: info.transactionBytes,
            maxTransactionSize: info.maxTransactionBytes,
            version: caps.preferredVersion,
            availableBytes: info.availableBytes,
          });
        } catch (error) {
          console.error('[HashDrop] Failed to calculate transaction info:', error);
        }
      }
    };
    calculateInfo();
  }, [content, publicKey]);

  // Handle publish - show confirmation dialog
  const handlePublish = useCallback(async () => {
    if (!content || !contentMeta || !publicKey) {
      console.error('[HashDrop] Cannot publish: missing requirements');
      return;
    }

    // Show confirmation dialog
    setIsConfirming(true);
  }, [content, contentMeta, publicKey]);

  // Confirm and proceed with publish (Memo Drop only)
  const confirmAndPublish = useCallback(async () => {
    setIsConfirming(false);

    if (!content || !contentMeta || !publicKey) {
      console.error('[HashDrop] Cannot publish: missing requirements');
      return;
    }

    setPublishProgress(20);

    try {
      console.log('[HashDrop] Starting Memo Drop publish');

      setPublishProgress(40);
      const connection = getConnection();
      
      // Get transaction capabilities
      const caps = await detectTransactionCapabilities(connection);
      const maxTransactionBytes = caps.maxTransactionBytes;
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      // Build the transaction
      const transaction = await buildMemoDropTransaction(
        content,
        contentMeta.hashDropId,
        contentMeta.hash,
        'text/plain',
        contentMeta.size,
        publicKey,
        connection
      );

      // Serialize and check actual size
      const serialized = serializeTransaction(transaction);
      const transactionSize = serialized.length;

      console.log('[HashDrop] Memo instruction built', {
        size: transactionSize,
        maxTransactionBytes,
        version: caps.preferredVersion,
      });

      // Validate transaction size
      if (transactionSize > maxTransactionBytes) {
        setLastResult({
          success: false,
          signature: null,
          error: `Transaction size (${transactionSize} bytes) exceeds maximum (${maxTransactionBytes} bytes) for ${caps.preferredVersion} transactions.`,
          blockTime: null,
        });
        return;
      }

      setPublishProgress(60);

      // Send transaction through wallet
      const result = await sendTransaction(transaction);

      setPublishProgress(80);
      setLastResult(result);

      if (result.success) {
        console.log('[HashDrop] Transaction sent:', result.signature);
        setPublishProgress(100);
        setTimeout(() => setPublishProgress(0), 2000);
      } else {
        console.error('[HashDrop] Transaction failed:', result.error);
      }
    } catch (error: any) {
      console.error('[HashDrop] Publish failed:', error);
      setLastResult({
        success: false,
        signature: null,
        error: error?.message || 'Publish failed',
        blockTime: null,
      });
    }
  }, [content, contentMeta, publicKey, sendTransaction]);

  // Cancel publish
  const cancelPublish = useCallback(() => {
    setIsConfirming(false);
  }, []);

  // Get display cost (Memo Drop only - no storage funding)
  const getDisplayCost = () => {
    return (estimate?.totalSol || 0) + DEFAULT_NETWORK_FEE_SOL;
  };

  // Update estimate
  useEffect(() => {
    if (contentMeta) {
      calculate(content);
    }
  }, [calculate, content, contentMeta]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <main className="flex-1 container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-accent">HashDrop</h1>
        <p className="text-secondary">
          Decentralized on-chain content publishing
        </p>
      </div>

      {/* Content Input Section */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Content</h2>
        <ContentEditor
          content={content}
          onContentChange={setContent}
          bytes={contentMeta?.size || 0}
        />
      </section>

      {/* Hash Information */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Hash</h2>
        <div className="font-mono text-xs break-all bg-black p-2 rounded">
          {contentMeta?.hash || 'SHA256 hash will be calculated after connecting wallet'}
        </div>
        <div className="mt-2 text-sm text-secondary">
          HashDrop ID: {contentMeta?.hashDropId || 'Will be generated automatically'}
        </div>
      </section>

      {/* Publication Method Selector - Memo Drop Only */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Publish Method</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-black rounded">
            <div className="flex items-center gap-3">
              <div className="font-medium text-primary w-full">
                <div className="font-medium text-primary">HashDrop Memo Drop</div>
                <div className="text-sm text-secondary">
                  {transactionInfo ? (
                    <>
                      Transaction: {formatBytes(transactionInfo.transactionSize)} / {formatBytes(transactionInfo.maxTransactionSize)} ({transactionInfo.version.toUpperCase()})
                      {transactionInfo.availableBytes < 0 && ' - Content too large'}
                    </>
                  ) : (
                    `Content must fit within transaction limits • transaction-based`
                  )}
                </div>
              </div>
            </div>
            {transactionInfo && transactionInfo.availableBytes >= 0 && (
              <span className="text-accent text-xs font-mono">SELECTED</span>
            )}
          </div>
        </div>
      </section>

      {/* Cost Summary */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Cost Summary</h2>
        <CostSummary estimate={estimate} method="memo" />
      </section>

      {/* Wallet Connection */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Wallet</h2>
        <WalletConnect
          isConnected={isConnected}
          publicKey={publicKey}
          onConnect={connect}
          onDisconnect={disconnect}
        />
        <div className="text-xs text-secondary mt-2">
          Network: {network}
        </div>
      </section>

      {/* Results */}
      {lastResult && (
        <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3 text-primary">
            Result {lastResult.success ? 'OK' : 'FAILED'}
          </h2>
          <div className="text-sm">
            {lastResult.success ? (
              <div>
                <div className="text-green-400 mb-2">Transaction successful!</div>
                <div className="font-mono text-xs break-all">
                  {lastResult.signature}
                </div>
              </div>
            ) : (
              <div className="text-red-400">
                Error: {lastResult.error}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      {isConfirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-primary">Confirm Publication</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-secondary">Method:</span>
                <span className="font-mono text-accent">HashDrop Memo Drop</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-secondary">Estimated Cost:</span>
                <span className="text-accent font-bold">{getDisplayCost().toFixed(6)} SOL</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-secondary">Content Size:</span>
                <span className="text-accent">{contentMeta?.size || 0} bytes</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-secondary">Transaction Size:</span>
                <span className="text-accent">
                  {transactionInfo ? `${formatBytes(transactionInfo.transactionSize)} / ${formatBytes(transactionInfo.maxTransactionSize)} (${transactionInfo.version.toUpperCase()})` : 'Calculating...'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-secondary">HashDrop ID:</span>
                <span className="font-mono text-xs text-accent break-all">
                  {contentMeta?.hashDropId?.slice(0, 16)}...
                </span>
              </div>
            </div>
            
            <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 mb-4">
              <p className="text-sm text-yellow-300">
                This will send a transaction to the Solana network. You will be prompted to confirm in your wallet.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelPublish}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndPublish}
                className="px-4 py-2 bg-accent text-white font-bold rounded hover:opacity-90"
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Button */}
      <section>
        <PublishButton
          isConnected={isConnected}
          progress={publishProgress}
          onPublish={handlePublish}
          onReset={() => {
            setPublishProgress(0);
            setLastResult(null);
          }}
        />
      </section>

      {/* Navigation */}
      <section className="mt-8 pt-4 border-t border-gray-700">
        <a 
          href="/viewer" 
          className="inline-block text-sm text-accent hover:text-accent/80 transition"
        >
          ↗ Retrieve HashDrop
        </a>
      </section>
    </main>
  );
}