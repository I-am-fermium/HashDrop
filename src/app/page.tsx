'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, PublicKey, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';

import { useWallet, TransactionResult, getConnection } from '../hooks/useWallet';
import { useCostEstimate } from '../hooks/useCostEstimate';
import { processContent, ContentMeta } from '../lib/content';
import { encodePublicPayload, canFitInMemo, MEMO_PROGRAM_ID, calculateTransactionSize, LEGACY_TRANSACTION_MAX_BYTES, V1_TRANSACTION_MAX_BYTES, HASHDROP_PRIVATE_CRYPTO_VERSION } from '../lib/memo';
import { detectTransactionCapabilities, buildPublicTransaction, buildProofDropTransaction, buildPrivateTransaction, serializeTransaction } from '../lib/transactions';
import { encryptPrivateContent, generateRecipientKeypair, PrivateEncryptionResult } from '../lib/crypto/privateDrop';
import { generateAesKey, generateAesIv } from '../lib/crypto/aesGcm';
import { bytesToBase64 } from '../lib/encoding';
import { exportArtifact } from '../lib/crypto/encryptedArtifact';
import { exportSecretKey, exportPublicKey } from '../lib/crypto/keyManager';
import {
  downloadTextFile,
  buildPrivateArtifactFilename,
  buildPrivateKeyFilename,
  buildPublicKeyFilename,
  PRIVATE_ARTIFACT_MIME_TYPE,
  PRIVATE_KEY_TEXT_MIME_TYPE,
  PUBLIC_KEY_TEXT_MIME_TYPE,
} from '../lib/download';
import { Network, getRpcUrlForLogging, createRpc, getExplorerUrl } from '../lib/network';

import { WalletConnect } from '../components/WalletConnect';
import { PublishButton } from '../components/PublishButton';
import { CostSummary } from '../components/CostSummary';
import { ContentEditor } from '../components/ContentEditor';
import { NetworkSelector } from '../components/NetworkSelector';

// Helper function to get network display label based on network state
// This is SSR-safe and matches the network state from useWallet
function getNetworkDisplayLabel(network: Network): string {
  return network === 'mainnet' ? 'Mainnet (Beta)' : 'Devnet';
}

// Helper to get provider name from RPC URL
function getProviderName(rpcUrl: string): string {
  if (rpcUrl.includes('helius-rpc.com')) return 'Helius';
  if (rpcUrl.includes('quicknode.com')) return 'QuickNode';
  if (rpcUrl.includes('alchemy.com')) return 'Alchemy';
  if (rpcUrl.includes('solana.fm')) return 'SolanaFM';
  if (rpcUrl.includes('api.mainnet-beta.solana.com')) return 'Solana';
  if (rpcUrl.includes('api.devnet.solana.com')) return 'Solana';
  return 'Custom';
}

/**
 * Client-side recovery data for a successful PRIVATE publish.
 *
 * `artifactEnvelope`, `privateKeyEnvelope` and `publicKeyEnvelope` are the
 * canonical versioned export strings produced by the existing crypto helpers
 * (exportArtifact / exportSecretKey / exportPublicKey) for the exact
 * encryption performed during THIS publish. They live only in client-side
 * state and are consumed exclusively by local Blob downloads — they are never
 * rendered, logged, persisted, or sent anywhere.
 */
interface PrivatePublishRecovery {
  hashDropId: string;
  sha256: string;
  contentSize: number;
  mimeType: string;
  cryptoVersion: string; // HD-P1
  keyFingerprint: string;
  signer: string;
  signature: string;
  artifactEnvelope: string;   // HASHDROP-PRIVATE-BLOB|v1|...
  privateKeyEnvelope: string; // HASHDROP-KEY|v1|ML-KEM-768|...
  publicKeyEnvelope: string;  // HASHDROP-PUBKEY|v1|ML-KEM-768|...
}

export default function Home() {
  const [content, setContent] = useState('Hello, HashDrop!');
  const [contentMeta, setContentMeta] = useState<ContentMeta | null>(null);
  const [publishProgress, setPublishProgress] = useState<number>(0);
  const [lastResult, setLastResult] = useState<TransactionResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [mode, setMode] = useState<'public' | 'proof' | 'private'>('public');
  const [privateKeypair, setPrivateKeypair] = useState<{ publicKey: Uint8Array; secretKey: Uint8Array } | null>(null);
  const [privateKeyExported, setPrivateKeyExported] = useState(false);
  const [artifactExported, setArtifactExported] = useState(false);
  // Recovery artifacts for the last successful PRIVATE publish. Set only
  // after the transaction is confirmed; intentionally NOT cleared on reset or
  // mode change so the user cannot lose access to the downloads by accident.
  const [privatePublishResult, setPrivatePublishResult] = useState<PrivatePublishRecovery | null>(null);
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

  // Track mounted state to prevent hydration mismatch
  // Network state is browser-dependent (reads from localStorage)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { isConnected, publicKey, connect, disconnect, sendTransaction, network, setNetwork } = useWallet();
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

  // Confirm and proceed with publish (Public or Proof Mode)
  const confirmAndPublish = useCallback(async () => {
    setIsConfirming(false);

    if (!content || !contentMeta || !publicKey) {
      console.error('[HashDrop] Cannot publish: missing requirements');
      return;
    }

    setPublishProgress(20);

    try {
      console.log('[HashDrop] Starting publish', {
        mode,
        network,
        rpc: getRpcUrlForLogging(),
      });

      setPublishProgress(40);

      // Use Solana Kit RPC client for getLatestBlockhash
      const rpc = createRpc();
      const provider = getProviderName(getRpcUrlForLogging());

      // Diagnostic logging for RPC operation
      console.log('[HashDrop] getLatestBlockhash operation:', {
        network,
        provider,
      });

      // Get latest blockhash using Solana Kit
      let blockhashResult;
      try {
        blockhashResult = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
      } catch (blockhashError: any) {
        console.error('[HashDrop] getLatestBlockhash failed:', {
          operation: 'getLatestBlockhash',
          network,
          provider,
          message: blockhashError?.message || 'Unknown error',
          code: blockhashError?.code,
        });

        throw blockhashError;
      }

      // Extract blockhash and lastValidBlockHeight from Solana Kit response
      const blockhash = blockhashResult.value.blockhash;
      const lastValidBlockHeight = BigInt(blockhashResult.value.lastValidBlockHeight);

      // Build the transaction using web3.js Connection (for Phantom compatibility)
      const connection = getConnection();

      // Build the transaction based on mode
      let transaction;
      // Holds the exact encryption outputs for PRIVATE mode so they can be
      // exported to the user after the transaction confirms. The exported
      // artifact is the one produced in the SAME encryption whose key
      // envelope goes on-chain — no second keypair, AES key, or encryption is
      // ever created for export purposes.
      let privateRecoverySource: {
        encryption: PrivateEncryptionResult;
        keypair: { publicKey: Uint8Array; secretKey: Uint8Array };
      } | null = null;
      if (mode === 'proof') {
        // Proof Mode: only the SHA-256 commitment and byte length are stored on-chain.
        // The original content is NEVER included in the transaction.
        transaction = await buildProofDropTransaction(
          contentMeta.hashDropId,
          contentMeta.hash,
          contentMeta.size,
          publicKey,
          connection
        );
      } else if (mode === 'private') {
        // Private Mode: encrypt content locally, store only commitment on-chain
        // Generate ML-KEM-768 keypair for this drop
        const keypair = await generateRecipientKeypair();
        setPrivateKeypair(keypair);

        // Calculate key fingerprint
        const { calculateKeyFingerprint } = require('../lib/crypto/keyManager');
        const keyFingerprint = await calculateKeyFingerprint(keypair.publicKey);

        // Encrypt the content
        const { stringToBytes } = require('../lib/content');
        const plaintext = stringToBytes(content);
        const encryptionResult = await encryptPrivateContent(
          plaintext,
          contentMeta.hash,
          contentMeta.contentType,
          keypair.publicKey,
          keyFingerprint,
          contentMeta.hashDropId
        );

        // Keep the exact artifact + keypair used for THIS drop so the user
        // can export them after the transaction is confirmed. This is the
        // SAME encryption run whose key envelope is published on-chain.
        privateRecoverySource = { encryption: encryptionResult, keypair };

        // Build private transaction with on-chain commitment only
        // The encrypted artifact is stored off-chain
        transaction = await buildPrivateTransaction(
          contentMeta.hashDropId,
          encryptionResult.plaintextHash,
          encryptionResult.plaintextSize,
          encryptionResult.contentType,
          keyFingerprint,
          bytesToBase64(encryptionResult.encryptedKeyEnvelope.iv),
          bytesToBase64(encryptionResult.encryptedKeyEnvelope.encryptedKey),
          publicKey,
          connection
        );
      } else {
        // Public Mode: the full content is stored on-chain
        transaction = await buildPublicTransaction(
          content,
          contentMeta.hashDropId,
          contentMeta.hash,
          'text/plain',
          contentMeta.size,
          publicKey,
          connection
        );
      }

      // Serialize and check actual size
      const serialized = serializeTransaction(transaction);
      const transactionSize = serialized.length;

      console.log('[HashDrop] Transaction built', {
        mode,
        size: transactionSize,
        maxTransactionBytes: 128000, // v0 transaction max
        version: 'v0',
      });

      setPublishProgress(60);

      // Send transaction through wallet
      const result = await sendTransaction(transaction);

      setPublishProgress(80);
      setLastResult(result);

      if (result.success) {
        console.log('[HashDrop] Transaction sent:', result.signature);
        setPublishProgress(100);
        setTimeout(() => setPublishProgress(0), 2000);

        // Capture the client-side recovery artifacts for a successful PRIVATE
        // publish: the exact encrypted artifact produced during THIS publish
        // and the exact ML-KEM-768 keypair that encrypted it. Both stay in
        // local state only and are exported via client-side Blob downloads —
        // never rendered, logged, persisted, or sent anywhere.
        if (mode === 'private' && privateRecoverySource && result.signature) {
          const { encryption, keypair } = privateRecoverySource;
          setPrivatePublishResult({
            hashDropId: encryption.hashDropId,
            sha256: encryption.plaintextHash,
            contentSize: encryption.plaintextSize,
            mimeType: encryption.contentType,
            cryptoVersion: HASHDROP_PRIVATE_CRYPTO_VERSION,
            keyFingerprint: encryption.keyFingerprint,
            signer: publicKey,
            signature: result.signature,
            artifactEnvelope: exportArtifact(encryption.encryptedArtifact),
            privateKeyEnvelope: exportSecretKey(keypair.secretKey),
            publicKeyEnvelope: exportPublicKey(keypair.publicKey),
          });
          setArtifactExported(false);
          setPrivateKeyExported(false);
        }
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
  }, [content, contentMeta, publicKey, sendTransaction, network, mode]);

  // Cancel publish
  const cancelPublish = useCallback(() => {
    setIsConfirming(false);
  }, []);

  // ── PRIVATE publish recovery exports ─────────────────────────────────────
  // Client-side Blob downloads of the exact artifact and ML-KEM-768 keypair
  // produced during the publish flow. No network requests, no server, no
  // external storage: the files never leave the user's browser except as
  // local downloads. The secret key envelope is never rendered or logged.
  const handleDownloadArtifact = useCallback(() => {
    if (!privatePublishResult) return;
    downloadTextFile(
      buildPrivateArtifactFilename(privatePublishResult.hashDropId),
      privatePublishResult.artifactEnvelope,
      PRIVATE_ARTIFACT_MIME_TYPE
    );
    setArtifactExported(true);
  }, [privatePublishResult]);

  const handleExportPrivateKey = useCallback(() => {
    if (!privatePublishResult) return;
    downloadTextFile(
      buildPrivateKeyFilename(privatePublishResult.keyFingerprint),
      privatePublishResult.privateKeyEnvelope,
      PRIVATE_KEY_TEXT_MIME_TYPE
    );
    setPrivateKeyExported(true);
  }, [privatePublishResult]);

  const handleExportPublicKey = useCallback(() => {
    if (!privatePublishResult) return;
    downloadTextFile(
      buildPublicKeyFilename(privatePublishResult.keyFingerprint),
      privatePublishResult.publicKeyEnvelope,
      PUBLIC_KEY_TEXT_MIME_TYPE
    );
  }, [privatePublishResult]);

  // Get display cost (Memo Drop only - no storage funding)
  // NOTE: estimate.totalSol already includes the platform fee + base network fee
  // (useCostEstimate: networkFeeLamports 5000 + protocolFeeLamports 1,000,000).
  // Do NOT add DEFAULT_NETWORK_FEE_SOL again here — that caused the
  // 0.001005 → 0.001010 double-count bug.
  const getDisplayCost = () => {
    return estimate?.totalSol || 0;
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

      {/* Network Selector */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Network</h2>
        <div className="flex items-center gap-4">
          <NetworkSelector 
            currentNetwork={network} 
            onNetworkChange={setNetwork} 
          />
          {/* Only show mainnet warning after hydration to prevent mismatch */}
          {mounted && network === 'mainnet' && (
            <div className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-600">
              Mainnet uses real SOL. Transactions are permanent.
            </div>
          )}
        </div>
        <div className="text-xs text-secondary mt-2">
          Network: {getNetworkDisplayLabel(network)}
        </div>
      </section>

      {/* Content Input Section */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Content</h2>
        <ContentEditor
          content={content}
          onContentChange={setContent}
          bytes={contentMeta?.size || 0}
        />
      </section>

      {/* Mode Selector */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Mode</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMode('public')}
            className={`p-2 sm:p-3 rounded border text-left transition ${
              mode === 'public'
                ? 'border-accent bg-accent/10'
                : 'border-gray-700 bg-black hover:border-gray-500'
            }`}
          >
            <div className="text-sm sm:text-base font-medium text-primary break-words">Public</div>
            <div className="text-xs text-secondary mt-1 break-words hyphens-auto">
              Publish the content publicly on Solana.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('proof')}
            className={`p-2 sm:p-3 rounded border text-left transition ${
              mode === 'proof'
                ? 'border-accent bg-accent/10'
                : 'border-gray-700 bg-black hover:border-gray-500'
            }`}
          >
            <div className="text-sm sm:text-base font-medium text-primary break-words">Proof</div>
            <div className="text-xs text-secondary mt-1 break-words hyphens-auto">
              Timestamp/prove without publishing content.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('private')}
            className={`p-2 sm:p-3 rounded border text-left transition ${
              mode === 'private'
                ? 'border-accent bg-accent/10'
                : 'border-gray-700 bg-black hover:border-gray-500'
            }`}
          >
            <div className="text-sm sm:text-base font-medium text-primary break-words">Private</div>
            <div className="text-xs text-secondary mt-1 break-words hyphens-auto">
              Encrypt content locally before publishing.
            </div>
          </button>
        </div>
        {mode === 'proof' && (
          <div className="mt-3 bg-blue-900/30 border border-blue-600 rounded p-3">
            <p className="text-sm text-blue-300">
              <strong>Proof Mode:</strong> The original content is NOT stored on-chain.
              Only its cryptographic proof (SHA-256 hash) and byte length are published.
              The content never leaves your browser.
            </p>
          </div>
        )}
        {mode === 'private' && (
          <div className="mt-3 bg-purple-900/30 border border-purple-600 rounded p-3">
            <p className="text-sm text-purple-300">
              <strong>Private Mode:</strong> Your content is encrypted locally using AES-256-GCM
              with post-quantum ML-KEM-768 key protection. Only the required key holder can decrypt it.
              The original content is NEVER stored on-chain.
            </p>
            <p className="text-xs text-purple-400 mt-2">
              Private mode stores a cryptographic commitment and encrypted key envelope
              on-chain. The encrypted content is kept in a local encrypted artifact that
              you must save — it is required to decrypt this drop later.
            </p>
          </div>
        )}
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
  Transaction: {formatBytes(transactionInfo.transactionSize)} / ~1 KB
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
              <div className="space-y-3">
                <div className="text-green-400 mb-2">Transaction successful!</div>
                <div>
                  <div className="text-xs text-secondary mb-1">Transaction Signature</div>
                  <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                    {lastResult.signature}
                  </div>
                </div>
                {mode === 'proof' && contentMeta && (
                  <>
                    <div>
                      <div className="text-xs text-secondary mb-1">Proof Hash (SHA-256)</div>
                      <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                        {contentMeta.hash}
                      </div>
                    </div>
                    <div className="bg-blue-900/30 border border-blue-600 rounded p-3">
                      <p className="text-xs text-blue-300">
                        Save this transaction signature. To verify later, you will need both
                        the signature and the original content. The content is not stored on-chain.
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <a
                    href={getExplorerUrl(lastResult.signature!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-accent hover:text-accent/80 transition"
                  >
                    View on Solana Explorer ↗
                  </a>
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

      {/* 🔐 PRIVATE Publish Result — client-side recovery artifacts */}
      {privatePublishResult && (
        <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-purple-600">
          <h2 className="text-lg font-semibold mb-1 text-primary">🔐 Private Drop Published</h2>
          <p className="text-sm text-secondary mb-4">
            Your private commitment has been published on Solana.
          </p>

          <div className="space-y-3 text-sm mb-4">
            <div>
              <div className="text-xs text-secondary mb-1">HashDrop ID</div>
              <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                {privatePublishResult.hashDropId}
              </div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">SHA-256</div>
              <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                {privatePublishResult.sha256}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Content Size:</span>
              <span className="text-accent">{privatePublishResult.contentSize} bytes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Crypto Version:</span>
              <span className="text-accent">{privatePublishResult.cryptoVersion}</span>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">Key Fingerprint</div>
              <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                {privatePublishResult.keyFingerprint}
              </div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">Transaction Signature</div>
              <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                {privatePublishResult.signature}
              </div>
            </div>
          </div>

          {/* Save Your Private Data */}
          <h3 className="text-md font-semibold mb-2 text-primary">Save Your Private Data</h3>
          <p className="text-sm text-secondary mb-3">
            Your encrypted artifact and ML-KEM private key are required to decrypt this
            Private Drop later. The transaction stores the cryptographic commitment and
            encrypted key envelope. Your encrypted content remains in the encrypted
            artifact you download.
          </p>

          <div className="space-y-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadArtifact}
                className="px-4 py-2 bg-accent text-white font-bold rounded hover:opacity-90 transition"
              >
                Download Encrypted Artifact
              </button>
              {artifactExported && (
                <span className="text-green-400 text-xs">✓ Saved — keep the .hdp file safe</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportPrivateKey}
                className="px-4 py-2 bg-accent text-white font-bold rounded hover:opacity-90 transition"
              >
                Export ML-KEM-768 Private Key
              </button>
              {privateKeyExported && (
                <span className="text-green-400 text-xs">✓ Saved — keep the key file safe</span>
              )}
            </div>
            <p className="text-xs text-yellow-400">
              Keep this key private. Anyone with this key may be able to decrypt Private
              Drops encrypted for this key.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportPublicKey}
                className="px-4 py-2 bg-gray-700 text-primary rounded hover:opacity-90 transition"
              >
                Export Public Key
              </button>
            </div>
          </div>

          {/* Prominent warning */}
          <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 mb-4">
            <p className="text-sm text-yellow-300">
              <strong>⚠️ IMPORTANT</strong>
              <br />
              HashDrop does not store or recover your encrypted artifact or ML-KEM private
              key. Save both securely before closing or refreshing this page. The SHA-256
              hash shown above is only a content commitment. It is NOT a decryption key.
            </p>
          </div>

          <a
            href="/viewer"
            className="inline-block text-sm text-accent hover:text-accent/80 transition"
          >
            ↗ Open the Viewer to decrypt &amp; verify this drop later
          </a>
        </section>
      )}

      {/* Confirmation Modal */}
      {isConfirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 text-primary">Confirm Publication</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-secondary">Mode:</span>
                <span className="text-accent font-bold">{mode === 'proof' ? 'Proof' : 'Public'}</span>
              </div>

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
  {transactionInfo ? `${formatBytes(transactionInfo.transactionSize)} / ~1 KB (${transactionInfo.version.toUpperCase()})` : 'Calculating...'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-secondary">HashDrop ID:</span>
                <span className="font-mono text-xs text-accent break-all">
                  {contentMeta?.hashDropId?.slice(0, 16)}...
                </span>
              </div>

              {/* Only show mainnet warning after hydration */}
              {mounted && network === 'mainnet' && (
                <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3">
                  <p className="text-sm text-yellow-300">
                    <strong>Mainnet Warning:</strong> This will send real SOL from your wallet. Transactions are permanent.
                  </p>
                </div>
              )}
            </div>

            {mode === 'proof' ? (
              <div className="bg-blue-900/30 border border-blue-600 rounded p-3 mb-4">
                <p className="text-sm text-blue-300">
                  <strong>Proof Mode:</strong> Only the SHA-256 hash and byte length will be stored on-chain.
                  The original content is NEVER published. It remains private in your browser.
                </p>
              </div>
            ) : mode === 'private' ? (
              <div className="bg-purple-900/30 border border-purple-600 rounded p-3 mb-4">
                <p className="text-sm text-purple-300">
                  <strong>Private Mode:</strong> The transaction stores the cryptographic
                  commitment and encrypted key envelope. After publishing you must download
                  the encrypted artifact and export your ML-KEM-768 private key — they are
                  required to decrypt later and cannot be recovered from the chain.
                </p>
              </div>
            ) : (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 mb-4">
                <p className="text-sm text-yellow-300">
                  This will send a transaction to the Solana network. You will be prompted to confirm in your wallet.
                </p>
              </div>
            )}
            
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