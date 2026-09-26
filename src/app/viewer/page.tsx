'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '../../hooks/useWallet';
import {
  verifyBySignature,
  verifyProofDrop,
  verifyProofDropBytes,
  verifyPrivateDrop,
  PublicVerificationResult,
  ProofVerificationResult,
  PrivateVerificationResult,
} from '../../lib/verification';
import { getConnection } from '../../lib/solana/networkCost';
import { getExplorerUrl, getNetworkDisplay } from '../../lib/network';
import { importSecretKey } from '../../lib/crypto/keyManager';
import { importArtifact } from '../../lib/crypto/encryptedArtifact';
import { normalizeTransactionSignature } from '../../lib/signature';
import { classifyMimeType, isMediaMime, formatFileSize } from '../../lib/media';
import { downloadBytesFile } from '../../lib/download';

import {
  adaptPublicVerifiedResult,
  adaptProofVerifiedResult,
  adaptPrivateVerifiedResult,
} from '../../lib/certificate/adapter';
import { VerificationCertificate } from '../../components/VerificationCertificate';

type ViewerStatus = 'START' | 'FETCHING' | 'DECODING' | 'VERIFYING' | 'VERIFIED' | 'FAILED';

/**
 * Format a Solana blockTime (Unix seconds) exactly like the certificate
 * does (`new Date(blockTime * 1000).toUTCString()`). Display-only — no RPC.
 */
function formatOnChainRecordTime(blockTime?: number | null): string {
  if (typeof blockTime !== 'number' || !Number.isFinite(blockTime) || blockTime <= 0) {
    return 'Not available';
  }
  return new Date(blockTime * 1000).toUTCString();
}

export default function Viewer() {
  const [hashDropId, setHashDropId] = useState('');
  const [signature, setSignature] = useState('');
  const [status, setStatus] = useState<ViewerStatus>('START');
  const [error, setError] = useState<string | null>(null);
  const [publicResult, setPublicResult] = useState<PublicVerificationResult | null>(null);
  const [proofResult, setProofResult] = useState<ProofVerificationResult | null>(null);
  const [proofContent, setProofContent] = useState('');
  const [isProofDrop, setIsProofDrop] = useState(false);
  const [privateResult, setPrivateResult] = useState<PrivateVerificationResult | null>(null);
  const [isPrivateDrop, setIsPrivateDrop] = useState(false);
  const [privateCommitment, setPrivateCommitment] = useState<{
    hashDropId: string;
    contentHash: string;
    contentSize: number;
    contentType: string;
    version: string;
    cryptoVersion: string;
    keyFingerprint: string;
    signature: string;
    signer: string;
  } | null>(null);
  const [privateArtifactEnvelope, setPrivateArtifactEnvelope] = useState('');
  const [privateSecretKey, setPrivateSecretKey] = useState('');
  // PROOF-mode media verification: the user supplies the exact original file.
  const [proofMediaFile, setProofMediaFile] = useState<{
    bytes: Uint8Array;
    name: string;
    mimeType: string;
  } | null>(null);
  const [proofMediaObjectUrl, setProofMediaObjectUrl] = useState<string | null>(null);

  const { connection } = useWallet();

  const resetResults = useCallback(() => {
    setPublicResult(null);
    setProofResult(null);
    setPrivateResult(null);
    setPrivateCommitment(null);
    setIsProofDrop(false);
    setIsPrivateDrop(false);
    setProofContent('');
    setProofMediaFile(null);
    if (proofMediaObjectUrl) URL.revokeObjectURL(proofMediaObjectUrl);
    setProofMediaObjectUrl(null);
    setError(null);
  }, [proofMediaObjectUrl]);

  /**
   * The single Retrieve entry point — invoked by the Retrieve button AND by
   * the shared-URL effect below, so there is exactly one retrieval/verification
   * path. `explicitSignature` lets /viewer?signature=<signature> pass the URL
   * value directly (never reading a stale `signature` state value); it is
   * mirrored into the signature input state so the field always shows exactly
   * what was retrieved.
   */
  const handleVerify = useCallback(async (explicitSignature?: string) => {
    if (explicitSignature !== undefined) setSignature(explicitSignature);
    const rawSignature = explicitSignature ?? signature;
    resetResults();
    if (!rawSignature.trim()) {
      setError('Please enter a transaction signature');
      return;
    }
    // Canonical validation: trim -> Base58 decode -> exactly 64 bytes.
    // Network-independent (a 64-byte signature is 87 OR 88 Base58 chars, so a
    // hard-coded textual length would wrongly reject real Mainnet signatures).
    const normalizedSignature = normalizeTransactionSignature(rawSignature);
    if (!normalizedSignature) {
      setError('Invalid transaction signature format');
      return;
    }
    setStatus('FETCHING');
    try {
      const conn = connection || getConnection();
      const result = await verifyBySignature(conn, normalizedSignature, hashDropId || undefined);
      if (result.verified) {
        setStatus('VERIFIED');
        setPublicResult(result);
      } else if (result.needsContent) {
        if (result.mode === 'PRIVATE') {
          setIsPrivateDrop(true);
          setStatus('START');
          setPrivateCommitment({
            hashDropId: result.hashDropId,
            contentHash: result.contentHash,
            contentSize: result.contentSize,
            contentType: result.contentType,
            version: result.version || '',
            cryptoVersion: result.cryptoVersion || '',
            keyFingerprint: result.keyFingerprint || '',
            signature: result.signature,
            signer: result.signer || '',
          });
        } else {
          setIsProofDrop(true);
          setStatus('START');
          setPublicResult(result);
        }
      } else {
        setStatus('FAILED');
        setError(result.error || 'Verification failed');
      }
    } catch (err) {
      setStatus('FAILED');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [signature, hashDropId, connection, resetResults]);

  /**
   * Shared-URL entry point: /viewer?signature=<signature> (the verification
   * link a certificate's QR/code opens). Feed that value into the SAME
   * handleVerify() the Retrieve button uses — no separate retrieval path.
   * The ref guard records the exact URL signature already processed so
   * re-renders, StrictMode's double effect invocation, and handleVerify's
   * identity changes can never start a second automatic retrieval, while a
   * page reload (fresh mount) still auto-retrieves. A missing or empty
   * `signature` parameter is ignored — plain /viewer stays manual-only.
   */
  const autoRetrievedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const urlSignature = new URLSearchParams(window.location.search).get('signature');
    if (!urlSignature || !urlSignature.trim()) return;
    if (autoRetrievedSignatureRef.current === urlSignature) return;
    autoRetrievedSignatureRef.current = urlSignature;
    void handleVerify(urlSignature);
  }, [handleVerify]);

  const handleProofMediaFileChosen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (!buffer) return;
      const bytes = new Uint8Array(buffer);
      setProofMediaFile({ bytes, name: file.name, mimeType: file.type || '' });
      if (proofMediaObjectUrl) URL.revokeObjectURL(proofMediaObjectUrl);
      setProofMediaObjectUrl(URL.createObjectURL(file));
      setError(null);
    };
    reader.readAsArrayBuffer(file);
  }, [proofMediaObjectUrl]);

  const handleProofVerify = useCallback(async () => {
    // The unified PROOF memo always carries a MIME type; media MIMEs require
    // the user to supply the exact original file, while text MIMEs use the
    // string-input flow.
    const isMedia = publicResult?.mimeType ? isMediaMime(publicResult.mimeType) : false;

    if (isMedia) {
      if (!proofMediaFile) {
        setError('Please select the original file to verify against the proof');
        return;
      }
    } else if (!proofContent) {
      setError('Please enter the original content to verify');
      return;
    }

    const normalizedSignature = normalizeTransactionSignature(signature);
    if (!normalizedSignature) {
      setError('Invalid transaction signature format');
      setStatus('FAILED');
      return;
    }
    setStatus('VERIFYING');
    setError(null);
    try {
      const conn = connection || getConnection();
      // Verification is always SHA-256(exact original bytes) compared against
      // the on-chain commitment — text is hashed byte-for-byte from its UTF-8
      // encoding, media byte-for-byte from the supplied file.
      const result = isMedia && proofMediaFile
        ? await verifyProofDropBytes(conn, normalizedSignature, proofMediaFile.bytes, hashDropId || undefined)
        : await verifyProofDrop(conn, normalizedSignature, proofContent, hashDropId || undefined);
      setProofResult(result);
      setStatus(result.verified ? 'VERIFIED' : 'FAILED');
      // Always report the LATEST result. The previous `&& !error` guard read a
      // stale `error` value from the render closure, so after one failed
      // verification every later failure was silent (the reason was dropped).
      if (!result.verified) {
        setError(result.error || 'Proof verification failed');
      }
    } catch (err) {
      setStatus('FAILED');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [signature, hashDropId, connection, proofContent, proofMediaFile, publicResult]);

  const handlePrivateVerify = useCallback(async () => {
    if (!privateArtifactEnvelope || !privateSecretKey) {
      setError('Please provide both the encrypted artifact and ML-KEM private key');
      return;
    }
    const normalizedSignature = normalizeTransactionSignature(signature);
    if (!normalizedSignature) {
      setError('Invalid transaction signature format');
      setStatus('FAILED');
      return;
    }
    setStatus('VERIFYING');
    setError(null);
    try {
      let secretKeyBytes: Uint8Array;
      try {
        secretKeyBytes = importSecretKey(privateSecretKey);
      } catch {
        setError('Invalid HashDrop ML-KEM-768 private key');
        setStatus('FAILED');
        return;
      }
      let artifact: ReturnType<typeof importArtifact>;
      try {
        artifact = importArtifact(privateArtifactEnvelope);
      } catch {
        setError('Invalid encrypted artifact format');
        setStatus('FAILED');
        return;
      }
      const conn = connection || getConnection();
      const result = await verifyPrivateDrop(
        conn, normalizedSignature, secretKeyBytes, artifact, artifact.mlKemCiphertext, hashDropId || undefined
      );
      setPrivateResult(result);
      setStatus(result.verified ? 'VERIFIED' : 'FAILED');
      if (!result.verified) {
        setError(result.error || 'Private verification failed');
      }
    } catch (err) {
      setStatus('FAILED');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [signature, hashDropId, connection, privateArtifactEnvelope, privateSecretKey]);

  const handleKeyFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setPrivateSecretKey((event.target?.result as string).trim());
    reader.readAsText(file);
  }, []);

  const handleArtifactFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setPrivateArtifactEnvelope((event.target?.result as string).trim());
    reader.readAsText(file);
  }, []);

  const getExplorerLink = () => {
    const normalized = normalizeTransactionSignature(signature);
    return normalized ? getExplorerUrl(normalized) : null;
  };

  return (
    <main className="min-h-screen bg-gray-950 text-primary p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-primary">Retrieve HashDrop</h1>

        {/* Retrieval Details */}
        <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3 text-primary">Retrieval Details</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-secondary mb-1">Transaction Signature</label>
              <input
                className="w-full bg-black text-primary font-mono p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder="Enter Solana transaction signature..."
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-secondary mb-1">HashDrop ID (optional)</label>
              <input
                className="w-full bg-black text-primary font-mono p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                placeholder="Enter HashDrop ID for additional validation..."
                value={hashDropId}
                onChange={(e) => setHashDropId(e.target.value)}
              />
            </div>
            <button
              onClick={() => void handleVerify()}
              disabled={status === 'FETCHING' || status === 'VERIFYING'}
              className="w-full bg-accent text-white font-bold py-2 px-4 rounded hover:opacity-90 transition disabled:opacity-50"
            >
              {status === 'FETCHING' ? 'Retrieving...' : 'RETRIEVE'}
            </button>
          </div>
        </section>

        {/* PUBLIC Drop Result */}
        {publicResult && publicResult.verified && (
          <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-primary">Public Drop</h2>
            <div className="space-y-3">
              <div className="text-green-400 font-bold">✓ VERIFIED</div>
              <div>
                <div className="text-xs text-secondary mb-1">HashDrop ID</div>
                <div className="font-mono text-xs text-accent">{publicResult.hashDropId}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">MIME Type</div>
                <div className="text-accent">{publicResult.contentType}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Content Size</div>
                <div className="text-accent">{publicResult.contentSize} bytes</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">SHA-256</div>
                <div className="font-mono text-xs text-accent break-all">{publicResult.contentHash}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Content</div>
                <div className="bg-black p-3 rounded font-mono text-sm text-accent whitespace-pre-wrap break-words">
                  {publicResult.content}
                </div>
              </div>
              {publicResult.signer && (
                <div>
                  <div className="text-xs text-secondary mb-1">Published By</div>
                  <div className="font-mono text-xs text-accent break-all">{publicResult.signer}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-secondary mb-1">Transaction Signature</div>
                <div className="font-mono text-xs text-accent break-all">{publicResult.signature}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">ON-CHAIN RECORD TIME</div>
                <div className="text-accent">{formatOnChainRecordTime(publicResult.blockTime)}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">BLOCK SLOT</div>
                <div className="text-accent">{publicResult.slot}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Network</div>
                <div className="text-accent">{getNetworkDisplay()}</div>
              </div>
            </div>
            {getExplorerLink() && (
              <a href={getExplorerLink()!} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-accent hover:text-accent/80">
                View on Solana Explorer ↗
              </a>
            )}
            {/* Verification Certificate */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <VerificationCertificate
                data={adaptPublicVerifiedResult(publicResult, {
                  networkDisplay: getNetworkDisplay(),
                })!}
              />
            </div>
          </section>
        )}

        {/* PROOF Drop */}
        {/* Kept visible after a FAILED verification (mirroring the PRIVATE
            section) so the user can correct the supplied content and retry,
            instead of having to re-run the whole retrieval. Hidden once the
            commitment is verified. */}
        {isProofDrop && !proofResult?.verified && (
          <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-primary">Proof Drop</h2>
            <div className="bg-blue-900/30 border border-blue-600 rounded p-3 mb-4">
              <div className="text-blue-300 font-bold mb-1">✓ ON-CHAIN COMMITMENT</div>
              <p className="text-sm text-blue-300">
                This HashDrop stores a cryptographic proof/timestamp.
                The original content is not stored on-chain.
              </p>
              <p className="text-sm text-blue-300 mt-2">
                To verify original content, provide the original content
                separately and compare its SHA-256 hash with the
                on-chain commitment.
              </p>
            </div>
            {publicResult && (
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <span className="text-secondary">HashDrop ID:</span>
                  <div className="font-mono text-xs text-accent break-all">{publicResult.hashDropId}</div>
                </div>
                <div>
                  <span className="text-secondary">Content Size:</span>
                  <div className="text-accent">{publicResult.contentSize} bytes</div>
                </div>
                <div className="col-span-2">
                  <span className="text-secondary">SHA-256:</span>
                  <div className="font-mono text-xs text-accent break-all">{publicResult.contentHash}</div>
                </div>
                {publicResult.signer && (
                  <div className="col-span-2">
                    <span className="text-secondary">Published By:</span>
                    <div className="font-mono text-xs text-accent break-all">{publicResult.signer}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-secondary">Transaction Signature:</span>
                  <div className="font-mono text-xs text-accent break-all">{publicResult.signature}</div>
                </div>
              </div>
            )}
            {publicResult && publicResult.mimeType && isMediaMime(publicResult.mimeType) ? (
              <>
                <div className="bg-blue-900/30 border border-blue-600 rounded p-3 mb-4">
                  <p className="text-sm text-blue-300">
                    <strong>Media Proof:</strong> this HashDrop commits to a{' '}
                    {publicResult.mimeType} file{publicResult.filename ? ` (${publicResult.filename})` : ''}.
                    Select the exact original file to verify its SHA-256 against the on-chain commitment.
                  </p>
                </div>
                <div className="mb-3">
                  {proofMediaFile ? (
                    <div className="bg-black border border-gray-700 rounded p-3">
                      <div className="text-sm text-primary mb-1">Selected file:</div>
                      <div className="text-xs text-accent break-all">{proofMediaFile.name}</div>
                      <div className="text-xs text-secondary mt-1">
                        {formatFileSize(proofMediaFile.bytes.length)} · {proofMediaFile.mimeType || publicResult.mimeType}
                      </div>
                      <label className="mt-2 inline-block cursor-pointer bg-gray-700 text-primary px-3 py-1.5 rounded text-sm hover:opacity-90 transition">
                        Choose different file
                        <input
                          type="file"
                          className="hidden"
                          accept={publicResult.mimeType}
                          onChange={handleProofMediaFileChosen}
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="cursor-pointer block bg-black border border-dashed border-gray-600 rounded p-6 text-center hover:border-accent transition">
                      <div className="text-accent font-medium">Select the original file</div>
                      <div className="text-xs text-secondary mt-1">
                        The exact original file that was committed ({publicResult.mimeType})
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept={publicResult.mimeType}
                        onChange={handleProofMediaFileChosen}
                      />
                    </label>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-sm text-secondary mb-1">Original Content</label>
                  <textarea
                    className="w-full h-32 bg-black text-primary font-mono p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    placeholder="Enter the original content to verify against the proof..."
                    value={proofContent}
                    onChange={(e) => setProofContent(e.target.value)}
                  />
                </div>
              </>
            )}
            <button
              onClick={handleProofVerify}
              disabled={
                status === 'VERIFYING' ||
                (publicResult?.mimeType && isMediaMime(publicResult.mimeType) ? !proofMediaFile : !proofContent)
              }
              className="w-full bg-accent text-white font-bold py-2 px-4 rounded hover:opacity-90 transition disabled:opacity-50"
            >
              {status === 'VERIFYING' ? 'Verifying...' : 'VERIFY PROOF'}
            </button>
          </section>
        )}

        {/* PROOF Result */}
        {proofResult && (
          <section className={`bg-gray-900 rounded-lg p-4 mb-6 border ${proofResult.verified ? 'border-green-500' : 'border-red-500'}`}>
            <h2 className="text-lg font-semibold mb-3 text-primary">
              {proofResult.verified ? '✓ VERIFIED' : '✕ NOT VERIFIED'}
            </h2>
            <div className="space-y-3">
              {/* Media viewer for verified/inspected PROOF media */}
              {proofResult.verified && proofResult.mimeType && proofMediaObjectUrl && isMediaMime(proofResult.mimeType) && (
                <div className="bg-black border border-gray-700 rounded p-3">
                  {classifyMimeType(proofResult.mimeType) === 'IMAGE' && (
                    <div className="relative h-80 w-full overflow-hidden">
                      <Image
                        src={proofMediaObjectUrl}
                        alt="Verified media"
                        fill
                        unoptimized
                        className="object-contain rounded"
                      />
                    </div>
                  )}
                  {classifyMimeType(proofResult.mimeType) === 'VIDEO' && (
                    <video src={proofMediaObjectUrl} controls className="max-h-80 w-full rounded" />
                  )}
                  {classifyMimeType(proofResult.mimeType) === 'AUDIO' && (
                    <audio src={proofMediaObjectUrl} controls className="w-full" />
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt className="text-secondary">Filename</dt>
                    <dd className="text-accent break-all">{proofMediaFile?.name || proofResult.filename || 'original'}</dd>
                    <dt className="text-secondary">MIME Type</dt>
                    <dd className="text-accent break-all">{proofResult.mimeType}</dd>
                    <dt className="text-secondary">Size</dt>
                    <dd className="text-accent">{formatFileSize(proofResult.calculatedSize)}</dd>
                    <dt className="text-secondary">Verification</dt>
                    <dd className="text-green-400 font-bold">VERIFIED — hash matches on-chain commitment</dd>
                  </dl>
                  <button
                    type="button"
                    onClick={() => {
                      if (proofMediaFile) {
                        downloadBytesFile(proofMediaFile.name, proofMediaFile.bytes, proofMediaFile.mimeType || proofResult.mimeType || 'application/octet-stream');
                      } else if (proofMediaObjectUrl) {
                        const a = document.createElement('a');
                        a.href = proofMediaObjectUrl;
                        a.download = proofResult.filename || 'original';
                        a.click();
                      }
                    }}
                    className="mt-3 px-3 py-1.5 bg-accent text-white font-bold rounded hover:opacity-90 transition text-sm"
                  >
                    Download Original
                  </button>
                </div>
              )}
              {proofResult.verified && proofResult.mimeType && isMediaMime(proofResult.mimeType) && !proofMediaObjectUrl && (
                <div className="text-yellow-300 text-sm bg-yellow-900/30 border border-yellow-600 rounded p-3">
                  The on-chain commitment verified, but the original file is no longer loaded in this session.
                  Re-select the file above to render it.
                </div>
              )}
              <div>
                <div className="text-xs text-secondary mb-1">HashDrop ID</div>
                <div className="font-mono text-xs text-accent break-all">{proofResult.hashDropId}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">On-chain SHA-256</div>
                <div className="font-mono text-xs text-accent break-all">{proofResult.contentHash}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Calculated SHA-256</div>
                <div className="font-mono text-xs text-accent break-all">{proofResult.calculatedHash}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-secondary mb-1">On-chain Size</div>
                  <div className="text-accent">{proofResult.contentSize} bytes</div>
                </div>
                <div>
                  <div className="text-xs text-secondary mb-1">Calculated Size</div>
                  <div className="text-accent">{proofResult.calculatedSize} bytes</div>
                </div>
              </div>
              {proofResult.signer && (
                <div>
                  <div className="text-xs text-secondary mb-1">Published By</div>
                  <div className="font-mono text-xs text-accent break-all">{proofResult.signer}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-secondary mb-1">Transaction Signature</div>
                <div className="font-mono text-xs text-accent break-all">{proofResult.signature}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">ON-CHAIN RECORD TIME</div>
                <div className="text-accent">{formatOnChainRecordTime(proofResult.blockTime)}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">BLOCK SLOT</div>
                <div className="text-accent">{proofResult.slot}</div>
              </div>
            </div>
            {getExplorerLink() && (
              <a href={getExplorerLink()!} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-accent hover:text-accent/80">
                View on Solana Explorer ↗
              </a>
            )}
            {/* Verification Certificate */}
            {proofResult.verified && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <VerificationCertificate
                  data={adaptProofVerifiedResult(proofResult, {
                    networkDisplay: getNetworkDisplay(),
                  })!}
                />
              </div>
            )}
          </section>
        )}


        {/* PRIVATE Drop */}
        {isPrivateDrop && !privateResult?.verified && (
          <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-3 text-primary">🔐 Private Drop</h2>
            <div className="bg-purple-900/30 border border-purple-600 rounded p-3 mb-4">
              <p className="text-sm text-purple-300">
                This transaction stores a cryptographic commitment
                and encrypted key envelope.
              </p>
              <p className="text-sm text-purple-300 mt-2">
                The encrypted content itself is NOT stored on-chain.
                You must provide the encrypted artifact and your ML-KEM-768 private key to decrypt.
              </p>
            </div>
            {privateCommitment && (
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <span className="text-secondary">HashDrop ID:</span>
                  <div className="font-mono text-xs text-accent break-all">{privateCommitment.hashDropId}</div>
                </div>
                <div>
                  <span className="text-secondary">Content Size:</span>
                  <div className="text-accent">{privateCommitment.contentSize} bytes</div>
                </div>
                <div className="col-span-2">
                  <span className="text-secondary">SHA-256:</span>
                  <div className="font-mono text-xs text-accent break-all">{privateCommitment.contentHash}</div>
                </div>
                <div>
                  <span className="text-secondary">MIME Type:</span>
                  <div className="text-accent">{privateCommitment.contentType}</div>
                </div>
                <div>
                  <span className="text-secondary">Crypto Version:</span>
                  <div className="text-accent">{privateCommitment.cryptoVersion}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-secondary">Key Fingerprint:</span>
                  <div className="font-mono text-xs text-accent break-all">{privateCommitment.keyFingerprint}</div>
                </div>
                {privateCommitment.signer && (
                  <div className="col-span-2">
                    <span className="text-secondary">Published By:</span>
                    <div className="font-mono text-xs text-accent break-all">{privateCommitment.signer}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="text-secondary">Transaction Signature:</span>
                  <div className="font-mono text-xs text-accent break-all">{privateCommitment.signature}</div>
                </div>
              </div>
            )}
            <h3 className="text-md font-semibold mb-3 text-primary">Decryption</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-secondary mb-1">Encrypted Artifact</label>
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 h-24 bg-black text-primary font-mono p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent text-xs"
                    placeholder="Paste artifact (HASHDROP-PRIVATE-BLOB|v1|...) or import file..."
                    value={privateArtifactEnvelope}
                    onChange={(e) => setPrivateArtifactEnvelope(e.target.value)}
                  />
                  <label className="cursor-pointer bg-gray-700 text-primary px-3 py-2 rounded hover:opacity-90 transition text-sm self-end">
                    Import Artifact File
                    <input type="file" className="hidden" onChange={handleArtifactFileImport} accept=".hdp,.txt,.json,application/octet-stream,text/plain" />
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-secondary mb-1">ML-KEM-768 Private Key</label>
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 h-24 bg-black text-primary font-mono p-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-accent text-xs"
                    placeholder="Paste private key (HASHDROP-KEY|v1|...) or import file..."
                    value={privateSecretKey}
                    onChange={(e) => setPrivateSecretKey(e.target.value)}
                  />
                  <label className="cursor-pointer bg-gray-700 text-primary px-3 py-2 rounded hover:opacity-90 transition text-sm self-end">
                    Import Private Key File
                    <input type="file" className="hidden" onChange={handleKeyFileImport} accept=".txt,.json" />
                  </label>
                </div>
              </div>
              <button
                onClick={handlePrivateVerify}
                disabled={status === 'VERIFYING' || !privateSecretKey || !privateArtifactEnvelope}
                className="w-full bg-accent text-white font-bold py-2 px-4 rounded hover:opacity-90 transition disabled:opacity-50"
              >
                {status === 'VERIFYING' ? 'Decrypting...' : 'DECRYPT & VERIFY'}
              </button>
            </div>
            {getExplorerLink() && (
              <a href={getExplorerLink()!} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-accent hover:text-accent/80">
                View on Solana Explorer ↗
              </a>
            )}
          </section>
        )}

        {/* PRIVATE Result */}
        {privateResult && privateResult.verified && (
          <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-green-500">
            <h2 className="text-lg font-semibold mb-3 text-primary">🔐 Private Drop — Decrypted</h2>
            <div className="space-y-3">
              <div className="text-green-400 font-bold">✓ DECRYPTED & VERIFIED</div>
              {/* Media viewer for decrypted PRIVATE media */}
              {privateResult.plaintextBytes && privateResult.mimeType && isMediaMime(privateResult.mimeType) && (
                <div className="bg-black border border-gray-700 rounded p-3">
                  {classifyMimeType(privateResult.mimeType) === 'IMAGE' && (
                    <div className="relative h-80 w-full overflow-hidden">
                      <Image
                        src={URL.createObjectURL(new Blob([privateResult.plaintextBytes as BlobPart], { type: privateResult.mimeType }))}
                        alt="Decrypted media"
                        fill
                        unoptimized
                        className="object-contain rounded"
                      />
                    </div>
                  )}
                  {classifyMimeType(privateResult.mimeType) === 'VIDEO' && (
                    <video
                      src={URL.createObjectURL(new Blob([privateResult.plaintextBytes as BlobPart], { type: privateResult.mimeType }))}
                      controls
                      className="max-h-80 w-full rounded"
                    />
                  )}
                  {classifyMimeType(privateResult.mimeType) === 'AUDIO' && (
                    <audio
                      src={URL.createObjectURL(new Blob([privateResult.plaintextBytes as BlobPart], { type: privateResult.mimeType }))}
                      controls
                      className="w-full"
                    />
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt className="text-secondary">Filename</dt>
                    <dd className="text-accent break-all">{privateResult.filename || 'decrypted-original'}</dd>
                    <dt className="text-secondary">MIME Type</dt>
                    <dd className="text-accent break-all">{privateResult.mimeType}</dd>
                    <dt className="text-secondary">Size</dt>
                    <dd className="text-accent">{formatFileSize(privateResult.calculatedSize)}</dd>
                    <dt className="text-secondary">Verification</dt>
                    <dd className="text-green-400 font-bold">AES-GCM authenticated · SHA-256 matches on-chain commitment</dd>
                  </dl>
                  <button
                    type="button"
                    onClick={() => {
                      if (privateResult.plaintextBytes) {
                        downloadBytesFile(
                          privateResult.filename || 'decrypted-original',
                          privateResult.plaintextBytes,
                          privateResult.mimeType || 'application/octet-stream'
                        );
                      }
                    }}
                    className="mt-3 px-3 py-1.5 bg-accent text-white font-bold rounded hover:opacity-90 transition text-sm"
                  >
                    Download Original
                  </button>
                </div>
              )}
              {privateResult.mimeType && isMediaMime(privateResult.mimeType) && !privateResult.plaintextBytes && (
                <div className="text-red-400 text-sm bg-red-900/30 border border-red-600 rounded p-3">
                  Decryption failed or the recovered bytes could not be obtained. The content will not be
                  displayed as valid unless AES-GCM authentication and SHA-256 verification succeed.
                </div>
              )}
              <div>
                <div className="text-xs text-secondary mb-1">HashDrop ID</div>
                <div className="font-mono text-xs text-accent break-all">{privateResult.hashDropId}</div>
              </div>
              {privateResult.signer && (
                <div>
                  <div className="text-xs text-secondary mb-1">Published By</div>
                  <div className="font-mono text-xs text-accent break-all">{privateResult.signer}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-secondary mb-1">On-chain SHA-256</div>
                <div className="font-mono text-xs text-accent break-all">{privateResult.contentHash}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Calculated SHA-256</div>
                <div className="font-mono text-xs text-accent break-all">{privateResult.calculatedHash}</div>
              </div>
              {privateResult.plaintext && !(privateResult.mimeType && isMediaMime(privateResult.mimeType)) && (
                <div>
                  <div className="text-xs text-secondary mb-1">Decrypted Content</div>
                  <div className="bg-black p-3 rounded font-mono text-sm text-accent whitespace-pre-wrap break-words">
                    {privateResult.plaintext}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-secondary mb-1">Crypto</div>
                <div className="text-accent">AES-256-GCM + ML-KEM-768 + HKDF-SHA-256</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">Transaction Signature</div>
                <div className="font-mono text-xs text-accent break-all">{privateResult.signature}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">ON-CHAIN RECORD TIME</div>
                <div className="text-accent">{formatOnChainRecordTime(privateResult.blockTime)}</div>
              </div>
              <div>
                <div className="text-xs text-secondary mb-1">BLOCK SLOT</div>
                <div className="text-accent">{privateResult.slot}</div>
              </div>
            </div>
            {getExplorerLink() && (
              <a href={getExplorerLink()!} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm text-accent hover:text-accent/80">
                View on Solana Explorer ↗
              </a>
            )}
            {/* Verification Certificate */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <VerificationCertificate
                data={adaptPrivateVerifiedResult(privateResult, {
                  networkDisplay: getNetworkDisplay(),
                  keyFingerprint: privateCommitment?.keyFingerprint,
                })!}
              />
            </div>
          </section>
        )}

        {/* Error State */}
        {error && (
          <section className="bg-gray-900 rounded-lg p-4 border border-gray-700 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-primary">❌ VERIFICATION FAILED</h2>
            <p className="text-sm text-red-400">{error}</p>
          </section>
        )}

        {/* Navigation */}
        <section className="mt-8 pt-4 border-t border-gray-700">
          <Link href="/" className="inline-block text-sm text-accent hover:text-accent/80 transition">
            ← Publish HashDrop
          </Link>
        </section>
      </div>
    </main>
  );
}
