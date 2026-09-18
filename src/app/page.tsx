'use client';

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';

import { useWallet, TransactionResult, getConnection } from '../hooks/useWallet';
import { useCostEstimate } from '../hooks/useCostEstimate';
import { processContent, generateHashDropId } from '../lib/content';
import { HASHDROP_PRIVATE_CRYPTO_VERSION } from '../lib/memo';
import { buildPublicTransaction, buildProofDropTransaction, buildPrivateTransaction, serializeTransaction, measurePublicTransactionSize } from '../lib/transactions';
import { encryptPrivateContent, generateRecipientKeypair, PrivateEncryptionResult } from '../lib/crypto/privateDrop';
import { bytesToBase64 } from '../lib/encoding';
import { exportArtifact } from '../lib/crypto/encryptedArtifact';
import { exportSecretKey, exportPublicKey } from '../lib/crypto/keyManager';
import {
  downloadTextFile,
  downloadBytesFile,
  buildPrivateArtifactFilename,
  buildPrivateKeyFilename,
  buildPublicKeyFilename,
  PRIVATE_ARTIFACT_MIME_TYPE,
  PRIVATE_KEY_TEXT_MIME_TYPE,
  PUBLIC_KEY_TEXT_MIME_TYPE,
} from '../lib/download';
import { Network, getRpcUrlForLogging, createRpc, getExplorerUrl } from '../lib/network';
import { ContentKind, ArtifactMeta, processMediaBytes, formatFileSize } from '../lib/media';

import { WalletConnect } from '../components/WalletConnect';
import { PublishButton } from '../components/PublishButton';
import { CostSummary } from '../components/CostSummary';
import { ContentInput, MediaSelection } from '../components/ContentInput';
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
  cryptoVersion: string; // HD-P2
  keyFingerprint: string;
  signer: string;
  signature: string;
  artifactEnvelope: string;   // HASHDROP-PRIVATE-BLOB|v1|...
  privateKeyEnvelope: string; // HASHDROP-KEY|v1|ML-KEM-768|...
  publicKeyEnvelope: string;  // HASHDROP-PUBKEY|v1|ML-KEM-768|...
}

export default function Home() {
  const [content, setContent] = useState('Hello, HashDrop!');
  // Processed TEXT artifact (contentKind 'TEXT', filename '') — part of the
  // unified artifact model; media artifacts live in `mediaSelection.meta`.
  const [textMeta, setTextMeta] = useState<ArtifactMeta | null>(null);
  // Current input type (PUBLIC is forced to TEXT).
  const [contentKind, setContentKind] = useState<ContentKind>('TEXT');
  // Selected media object (photo/video/voice) — hashed from exact bytes.
  const [mediaSelection, setMediaSelection] = useState<MediaSelection | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [publishProgress, setPublishProgress] = useState<number>(0);
  const [lastResult, setLastResult] = useState<TransactionResult | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [mode, setMode] = useState<'public' | 'proof' | 'private'>('public');
  const [privateKeyExported, setPrivateKeyExported] = useState(false);
  const [artifactExported, setArtifactExported] = useState(false);
  // Recovery artifacts for the last successful PRIVATE publish. Set only
  // after the transaction is confirmed; intentionally NOT cleared on reset or
  // mode change so the user cannot lose access to the downloads by accident.
  const [privatePublishResult, setPrivatePublishResult] = useState<PrivatePublishRecovery | null>(null);
  const [transactionInfo, setTransactionInfo] = useState<{
    transactionSize: number | null;
    maxTransactionSize: number;
    version: string;
    availableBytes: number;
  } | null>(null);

  // Track mounted state to prevent hydration mismatch
  // Network state is browser-dependent (reads from localStorage)
  // (no setState-in-effect: useSyncExternalStore flips to true after hydration)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const { isConnected, publicKey, connect, disconnect, sendTransaction, network, setNetwork } = useWallet();
  const { estimate, calculate } = useCostEstimate(content);

  // Process text content when it changes (into the unified artifact model)
  useEffect(() => {
    const processContentData = async () => {
      if (content && content.length > 0) {
        try {
          const meta = await processContent(content, publicKey || 'pending');
          setTextMeta(meta);

          console.log('[HashDrop] Content processed:', {
            size: meta.size,
            hash: meta.hash,
            hashDropId: meta.hashDropId,
          });
        } catch (error) {
          console.error('[HashDrop] Content processing failed:', error);
        }
      } else {
        setTextMeta(null);
      }
    };
    processContentData();
  }, [content, publicKey]);

  // Derive the currently active artifact for publishing (TEXT or media),
  // always as the SAME unified ArtifactMeta. The deterministic HashDrop ID is
  // recalculated from the current creator wallet on every render (no effect,
  // no re-hash of the media bytes).
  const publishMeta: ArtifactMeta | null = useMemo(() => {
    const raw = contentKind === 'TEXT' || mode === 'public' ? textMeta : (mediaSelection?.meta ?? null);
    if (!raw) return null;
    const hashDropId = generateHashDropId(raw.hash, publicKey || 'pending', raw.size);
    if (hashDropId === raw.hashDropId) return raw;
    return { ...raw, hashDropId };
  }, [contentKind, mode, textMeta, mediaSelection, publicKey]);

  // PUBLIC mode is TEXT ONLY: never accept a media selection there, and never
  // let a hidden media selection leak into a Public publication. Returns
  // whether media state should be cleared (switching to PUBLIC).
  const handleModeChange = useCallback((nextMode: 'public' | 'proof' | 'private') => {
    if (nextMode === 'public') {
      setContentKind('TEXT');
      setMediaSelection((prev) => {
        if (prev) URL.revokeObjectURL(prev.objectUrl);
        return null;
      });
      setMediaError(null);
    }
    setMode(nextMode);
  }, []);

  /**
   * Handle a chosen media file (photo/video/audio picked in the file dialog).
   * Reads the exact original bytes once, validates MIME against the magic-byte
   * signature, and computes the SHA-256 hash. The authoritative original bytes
   * are retained for encryption and for the proof.
   */
  const handleFileChosen = useCallback(
    async (file: File, _declaredKind: 'IMAGE' | 'VIDEO' | 'AUDIO') => {
      setMediaError(null);
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const declared = file.type || 'application/octet-stream';
        const meta = await processMediaBytes(bytes, file.name || 'file', declared, publicKey || 'pending');
        // Revoke any previous preview URL before replacing the selection.
        setMediaSelection((prev) => {
          if (prev) URL.revokeObjectURL(prev.objectUrl);
          return null;
        });
        const objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: meta.mimeType }));
        setMediaSelection({ file, bytes, meta, objectUrl });
        setContentKind(meta.contentKind);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process the selected file.';
        setMediaError(message);
        console.error('[HashDrop] Media processing failed:', message);
      }
    },
    [publicKey]
  );

  const handleMediaRemove = useCallback(() => {
    setMediaSelection((prev) => {
      if (prev) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    setMediaError(null);
  }, []);

  // Calculate transaction size info and capabilities
  useEffect(() => {
    const calculateInfo = async () => {
      // The transaction-size calculation below encodes the FULL content into a
      // PUBLIC-mode payload (encodePublicPayload). It is only meaningful in
      // Public mode: Proof/Private never place the original content on-chain,
      // so the Public content-size restriction must not apply to them.
      if (mode !== 'public') {
        setTransactionInfo(null);
        return;
      }
      if (textMeta && publicKey) {
        try {
          // Measure the EXACT serialized size of the Public transaction that
          // will be submitted, via the same encoding/compilation path as
          // buildPublicTransaction (V3 PUBLIC memo with the real content +
          // platform-fee transfer, compiled to v0). Preview of reality.
          const measured = measurePublicTransactionSize(
            content,
            textMeta.hashDropId,
            textMeta.hash,
            textMeta.mimeType,
            textMeta.size,
            publicKey
          );
          setTransactionInfo({
            transactionSize: measured.size,
            maxTransactionSize: measured.maxBytes,
            version: 'v0',
            availableBytes: measured.size != null ? measured.maxBytes - measured.size : -1,
          });
        } catch (error) {
          console.error('[HashDrop] Failed to calculate transaction info:', error);
        }
      }
    };
    calculateInfo();
  }, [content, textMeta, publicKey, mode]);

  // Handle publish - show confirmation dialog
  const handlePublish = useCallback(async () => {
    const target = publishMeta;
    if (!target || !publicKey) {
      setLastResult({
        success: false,
        signature: null,
        error:
          contentKind === 'TEXT'
            ? 'Enter content and connect your wallet to publish.'
            : 'Select a valid file and connect your wallet to publish.',
        blockTime: null,
      });
      console.error('[HashDrop] Cannot publish: missing requirements');
      return;
    }

    // Show confirmation dialog
    setIsConfirming(true);
  }, [publishMeta, publicKey, contentKind]);

  // Confirm and proceed with publish (Public, Proof or Private Mode)
  const confirmAndPublish = useCallback(async () => {
    setIsConfirming(false);

    const target = publishMeta;
    if (!target || !publicKey) {
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

      // Get latest blockhash using Solana Kit. This acts as an RPC preflight:
      // a failed fetch aborts the publish early with a clear error. The mode
      // builders fetch their own blockhash when assembling the transaction, so
      // the response body is intentionally not used here.
      try {
        await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
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
        // Proof Mode: only the SHA-256 commitment, byte length, validated MIME
        // type and filename are stored on-chain. The original bytes are NEVER
        // included. The SAME unified memo shape is used for every content kind
        // (text proofs carry text/plain + '').
        transaction = await buildProofDropTransaction(
          target.hashDropId,
          target.hash,
          target.size,
          publicKey,
          connection,
          target.mimeType,
          target.filename
        );
      } else if (mode === 'private') {
        // Private Mode: encrypt content locally, store only commitment on-chain
        // Generate ML-KEM-768 keypair for this drop
        const keypair = await generateRecipientKeypair();

        // Calculate key fingerprint
        const { calculateKeyFingerprint } = require('../lib/crypto/keyManager');
        const keyFingerprint = await calculateKeyFingerprint(keypair.publicKey);

        // Encrypt the exact original bytes (text UTF-8 bytes or media bytes).
        // The AES-256-GCM + ML-KEM-768 + HKDF-SHA-256 architecture is reused
        // unchanged; the MIME type and filename are carried in the artifact
        // envelope. The on-chain memo format and AAD remain unchanged.
        const encryptionResult = await encryptPrivateContent(
          target.bytes,
          target.hash,
          target.mimeType,
          keypair.publicKey,
          keyFingerprint,
          target.hashDropId,
          target.filename
        );

        // Keep the exact artifact + keypair used for THIS drop so the user
        // can export them after the transaction is confirmed. This is the
        // SAME encryption run whose key envelope is published on-chain.
        privateRecoverySource = { encryption: encryptionResult, keypair };

        // Build private transaction with on-chain commitment only
        // The encrypted artifact is stored off-chain
        transaction = await buildPrivateTransaction(
          target.hashDropId,
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
        // Public Mode: TEXT ONLY — the full content is stored on-chain.
        transaction = await buildPublicTransaction(
          content,
          target.hashDropId,
          target.hash,
          'text/plain',
          target.size,
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
  }, [publishMeta, publicKey, sendTransaction, network, mode, content]);

  // Cancel publish
  const cancelPublish = useCallback(() => {
    setIsConfirming(false);
  }, []);

  // ── PROOF media original-artifact export ────────────────────────────────
  // PROOF-mode media is zero-backend like everything else in HashDrop: only
  // the commitment goes on-chain; the original bytes stay with the user. This
  // lets them save the exact file that was committed.
  const handleDownloadOriginalMedia = useCallback(() => {
    if (!mediaSelection) return;
    downloadBytesFile(mediaSelection.meta.filename, mediaSelection.bytes, mediaSelection.meta.mimeType);
  }, [mediaSelection]);

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
    if (textMeta) {
      calculate(content);
    }
  }, [calculate, content, textMeta]);

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
        <ContentInput
          mode={mode}
          content={content}
          onContentChange={setContent}
          contentKind={contentKind}
          onContentKindChange={(kind) => {
            setContentKind(kind);
            setMediaError(null);
          }}
          onFileChosen={handleFileChosen}
          media={mediaSelection}
          onMediaRemove={handleMediaRemove}
          bytes={textMeta?.size || 0}
          mediaError={mediaError}
          onError={setMediaError}
        />
      </section>

      {/* Mode Selector */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Mode</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => handleModeChange('public')}
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
            onClick={() => handleModeChange('proof')}
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
            onClick={() => handleModeChange('private')}
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
              <strong>Proof Mode:</strong> Text, Photo, Video and Voice are supported.
              The original content is NOT stored on-chain — only its cryptographic proof
              (SHA-256 hash), byte length, and content type are published. The content never
              leaves your browser.
            </p>
          </div>
        )}
        {mode === 'private' && (
          <div className="mt-3 bg-purple-900/30 border border-purple-600 rounded p-3">
            <p className="text-sm text-purple-300">
              <strong>Private Mode:</strong> Text, Photo, Video and Voice are supported.
              Your content is encrypted locally using AES-256-GCM with post-quantum ML-KEM-768
              key protection. Only the required key holder can decrypt it.
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
          {publishMeta?.hash || 'SHA256 hash will be calculated after processing content'}
        </div>
        <div className="mt-2 text-sm text-secondary">
          HashDrop ID: {publishMeta?.hashDropId || 'Will be generated automatically'}
        </div>
        {publishMeta && contentKind !== 'TEXT' && (
          <div className="mt-2 text-xs text-secondary space-y-1">
            <div>File: {publishMeta.filename} · {formatFileSize(publishMeta.size)}</div>
            <div>MIME: {publishMeta.mimeType} · Type: {publishMeta.contentKind}</div>
          </div>
        )}
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
                  {mode === 'public' ? (
                    transactionInfo ? (
                      <>
  Transaction: {transactionInfo.transactionSize != null ? formatBytes(transactionInfo.transactionSize) : 'Too large'} / ~1 KB
                        {transactionInfo.availableBytes < 0 && ' - Content too large'}
                      </>
                    ) : (
                      `Content must fit within transaction limits • transaction-based`
                    )
                  ) : mode === 'proof' ? (
                    `Content (text or media) is not published on-chain • only the cryptographic proof/commitment and metadata are recorded`
                  ) : (
                    `Content (text or media) is encrypted locally (AES-256-GCM + ML-KEM-768) • the original content is never stored on-chain`
                  )}
                </div>
              </div>
            </div>
            {(mode !== 'public' || (transactionInfo && transactionInfo.availableBytes >= 0)) && (
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
                {mode === 'proof' && publishMeta && (
                  <>
                    <div>
                      <div className="text-xs text-secondary mb-1">Proof Hash (SHA-256)</div>
                      <div className="font-mono text-xs text-accent break-all bg-black p-2 rounded">
                        {publishMeta.hash}
                      </div>
                    </div>
                    {publishMeta.contentKind === 'TEXT' ? (
                      <div className="bg-blue-900/30 border border-blue-600 rounded p-3">
                        <p className="text-xs text-blue-300">
                          Save this transaction signature. To verify later, you will need both
                          the signature and the original content. The content is not stored on-chain.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-blue-900/30 border border-blue-600 rounded p-3 space-y-2">
                        <p className="text-xs text-blue-300">
                          This Proof commits to {publishMeta.mimeType} · {publishMeta.filename}.
                          Save the original file below — to verify later you will need this exact
                          file plus the transaction signature. The media is never stored on-chain.
                        </p>
                        <button
                          type="button"
                          onClick={handleDownloadOriginalMedia}
                          className="px-3 py-1.5 bg-accent text-white font-bold rounded hover:opacity-90 transition text-sm"
                        >
                          Download Original Media
                        </button>
                      </div>
                    )}
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
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">Mode:</span>
                <span className="text-accent font-bold">{mode === 'proof' ? 'Proof' : mode === 'private' ? 'Private' : 'Public'}</span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">Method:</span>
                <span className="font-mono text-accent">HashDrop Memo Drop</span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">Estimated Cost:</span>
                <span className="text-accent font-bold">{getDisplayCost().toFixed(6)} SOL</span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">Content Size:</span>
                <span className="text-accent">
                  {publishMeta?.size || 0} bytes
                </span>
              </div>

              {publishMeta && contentKind !== 'TEXT' && (
                <div className="space-y-1 text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-secondary">File:</span>
                    <span className="text-accent break-all">{publishMeta.filename}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-secondary">Type:</span>
                    <span className="text-accent">{publishMeta.mimeType} · {publishMeta.contentKind}</span>
                  </div>
                </div>
              )}

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">Transaction Size:</span>
                <span className="text-accent">
                  {mode === 'public'
                    ? transactionInfo
                      ? transactionInfo.transactionSize != null
                        ? `${formatBytes(transactionInfo.transactionSize)} / ~1 KB (${transactionInfo.version.toUpperCase()})`
                        : `Too large (${transactionInfo.version.toUpperCase()})`
                      : 'Calculating...'
                    : mode === 'proof'
                    ? 'Proof/commitment metadata only — media is not on-chain'
                    : 'Private/encrypted metadata only — media is not on-chain'}
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <span className="text-secondary">HashDrop ID:</span>
                <span className="font-mono text-xs text-accent break-all">
                  {publishMeta?.hashDropId?.slice(0, 16)}...
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
                  <strong>Proof Mode:</strong> Only the SHA-256 hash, byte length, and (for media)
                  the content type are stored on-chain. The original content is NEVER published.
                  It remains private in your browser.
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