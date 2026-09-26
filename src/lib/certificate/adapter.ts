/**
 * HashDrop Certificate Data Adapter
 *
 * Maps verified results (Public, Proof, Private) into certificate-safe structures.
 * Downstream-only: does not verify, hash, or modify underlying protocol.
 */

import {
  PublicVerificationResult,
  ProofVerificationResult,
  PrivateVerificationResult,
} from '../verification';
import { getExplorerUrl, getNetworkDisplay } from '../network';
import { VerificationCertificateData, VerificationExplanationItem } from './types';

export interface AdapterOptions {
  networkDisplay?: string;
  verifiedAt?: Date;
  origin?: string;
  keyFingerprint?: string;
}

function formatBlockTimeUtc(blockTime?: number | null): string | null {
  if (typeof blockTime !== 'number' || !Number.isFinite(blockTime) || blockTime <= 0) {
    return null;
  }
  // Convert Unix timestamp in seconds to human-readable UTC string
  return new Date(blockTime * 1000).toUTCString();
}

function formatVerifiedAtUtc(date?: Date): string {
  return (date || new Date()).toUTCString();
}

function buildVerificationUrl(signature: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://hashdrop.io');
  return `${base}/viewer?signature=${encodeURIComponent(signature)}`;
}

/**
 * Public Drop -> Certificate Data
 */
export function adaptPublicVerifiedResult(
  result: PublicVerificationResult,
  options?: AdapterOptions
): VerificationCertificateData | null {
  if (!result || !result.verified) return null;

  const networkStr = options?.networkDisplay || getNetworkDisplay();
  const verifiedAtStr = (options?.verifiedAt || new Date()).toISOString();
  const txSig = result.signature;
  const explorer = getExplorerUrl(txSig);
  const verificationUrl = buildVerificationUrl(txSig, options?.origin);

  const explanations: VerificationExplanationItem[] = [
    {
      term: 'SHA-256',
      explanation:
        'SHA-256 produces a fixed-length cryptographic fingerprint of the exact content bytes used by HashDrop. A change to the content would result in a different hash.',
    },
    {
      term: 'Transaction ID',
      explanation:
        'Identifies the Solana blockchain transaction containing the on-chain HashDrop record used as part of this verification.',
    },
    {
      term: 'On-chain Record Time',
      explanation:
        'Represents the timestamp associated with the blockchain record. If the RPC does not expose a block timestamp, this is displayed as Not available.',
    },
    {
      term: 'Verified At',
      explanation:
        'Represents the timestamp when HashDrop performed client-side cryptographic and on-chain verification.',
    },
    {
      term: 'Network',
      explanation:
        'Identifies the Solana blockchain cluster on which the on-chain record was published and verified.',
    },
  ];

  return {
    verified: true,
    certificateId: result.hashDropId,
    hashDropId: result.hashDropId,
    mode: 'PUBLIC',
    contentType: result.contentType || 'text/plain',
    mimeType: result.contentType || 'text/plain',
    originalSize: result.contentSize,
    filename: result.filename,
    sha256: result.contentHash || result.hash,

    network: networkStr,
    blockchain: 'Solana',
    transactionId: txSig,
    transactionVersion: result.transactionVersion,
    signer: result.signer,
    slot: result.slot,
    onChainRecordTime: formatBlockTimeUtc(result.blockTime),
    explorerUrl: explorer,

    verificationStatus: 'Verified',
    verifiedAt: formatVerifiedAtUtc(options?.verifiedAt),
    verificationMethod:
      'HashDrop on-chain transaction memo retrieval and SHA-256 byte-level cryptographic integrity verification',

    hashAlgorithm: 'SHA-256',
    protocolVersion: result.version || 'v3',

    explanations,
    verificationUrl,
  };
}

export { buildVerificationUrl };

/**
 * Proof Drop -> Certificate Data
 */
export function adaptProofVerifiedResult(
  result: ProofVerificationResult,
  options?: AdapterOptions
): VerificationCertificateData | null {
  if (!result || !result.verified) return null;

  const networkStr = options?.networkDisplay || getNetworkDisplay();
  const verifiedAtStr = (options?.verifiedAt || new Date()).toISOString();
  const txSig = result.signature;
  const explorer = getExplorerUrl(txSig);
  const verificationUrl = buildVerificationUrl(txSig, options?.origin);

  const explanations: VerificationExplanationItem[] = [
    {
      term: 'Cryptographic Commitment',
      explanation:
        'Proof Drop stores only the cryptographic commitment on-chain. Verification proved that the independently supplied content bytes match the on-chain SHA-256 hash byte-for-byte.',
    },
    {
      term: 'SHA-256',
      explanation:
        'SHA-256 produces a fixed-length cryptographic fingerprint of the exact content bytes used by HashDrop. A change to the content would result in a different hash.',
    },
    {
      term: 'Transaction ID',
      explanation:
        'Identifies the Solana blockchain transaction containing the on-chain HashDrop record used as part of this verification.',
    },
    {
      term: 'On-chain Record Time',
      explanation:
        'Represents the timestamp associated with the blockchain record. If the RPC does not expose a block timestamp, this is displayed as Not available.',
    },
    {
      term: 'Verified At',
      explanation:
        'Represents the timestamp when HashDrop performed client-side cryptographic and on-chain verification.',
    },
    {
      term: 'Network',
      explanation:
        'Identifies the Solana blockchain cluster on which the on-chain record was published and verified.',
    },
  ];

  return {
    verified: true,
    certificateId: result.hashDropId,
    hashDropId: result.hashDropId,
    mode: 'PROOF',
    contentType: result.mimeType || 'text/plain',
    mimeType: result.mimeType,
    originalSize: result.calculatedSize || result.contentSize,
    filename: result.filename,
    sha256: result.contentHash || result.calculatedHash,

    network: networkStr,
    blockchain: 'Solana',
    transactionId: txSig,
    transactionVersion: result.transactionVersion,
    signer: result.signer,
    slot: result.slot,
    onChainRecordTime: formatBlockTimeUtc(result.blockTime),
    explorerUrl: explorer,

    verificationStatus: 'Verified',
    verifiedAt: formatVerifiedAtUtc(options?.verifiedAt),
    verificationMethod:
      'HashDrop on-chain commitment retrieval and independent SHA-256 content byte-for-byte verification',

    hashAlgorithm: 'SHA-256',
    protocolVersion: result.version || 'v3',

    explanations,
    verificationUrl,
  };
}
/**
 * Private Drop -> Certificate Data
 * CRITICAL: Never exposes plaintext, private keys, ML-KEM secret material, or AES keys.
 */
export function adaptPrivateVerifiedResult(
  result: PrivateVerificationResult,
  options?: AdapterOptions
): VerificationCertificateData | null {
  if (!result || !result.verified) return null;

  const networkStr = options?.networkDisplay || getNetworkDisplay();
  const verifiedAtStr = (options?.verifiedAt || new Date()).toISOString();
  const txSig = result.signature;
  const explorer = getExplorerUrl(txSig);
  const verificationUrl = buildVerificationUrl(txSig, options?.origin);

  const explanations: VerificationExplanationItem[] = [
    {
      term: 'End-to-End Encryption',
      explanation:
        'The content is encrypted off-chain using AES-256-GCM and post-quantum ML-KEM-768. The on-chain record carries the cryptographic commitment and encrypted key envelope.',
    },
    {
      term: 'Key Fingerprint',
      explanation:
        'The public identifier of the ML-KEM-768 recipient public key bound to this Drop. Private keys and decrypted plaintext are never stored or included in this certificate.',
    },
    {
      term: 'SHA-256',
      explanation:
        'SHA-256 produces a fixed-length cryptographic fingerprint of the exact plaintext bytes. Verified against the authenticated on-chain commitment.',
    },
    {
      term: 'Transaction ID',
      explanation:
        'Identifies the Solana blockchain transaction containing the on-chain HashDrop record used as part of this verification.',
    },
    {
      term: 'Verified At',
      explanation:
        'Represents the timestamp when HashDrop performed client-side post-quantum decapsulation, AES-GCM authentication, and SHA-256 verification.',
    },
    {
      term: 'Network',
      explanation:
        'Identifies the Solana blockchain cluster on which the on-chain record was published and verified.',
    },
  ];

  return {
    verified: true,
    certificateId: result.hashDropId,
    hashDropId: result.hashDropId,
    mode: 'PRIVATE',
    contentType: result.contentType || result.mimeType || 'application/octet-stream',
    mimeType: result.mimeType,
    originalSize: result.calculatedSize || result.contentSize,
    filename: result.filename,
    sha256: result.contentHash || result.calculatedHash,

    network: networkStr,
    blockchain: 'Solana',
    transactionId: txSig,
    transactionVersion: result.transactionVersion,
    signer: result.signer,
    slot: result.slot,
    onChainRecordTime: formatBlockTimeUtc(result.blockTime),
    explorerUrl: explorer,

    verificationStatus: 'Verified',
    verifiedAt: formatVerifiedAtUtc(options?.verifiedAt),
    verificationMethod:
      'HashDrop ML-KEM-768 decapsulation, AES-256-GCM authentication, and SHA-256 plaintext commitment verification',

    hashAlgorithm: 'SHA-256',
    protocolVersion: result.version || 'v3',
    cryptoVersion: 'HD-P2',
    keyFingerprint: options?.keyFingerprint,
    encryptionAlgorithm: 'AES-256-GCM + ML-KEM-768 + HKDF-SHA-256',

    explanations,
    verificationUrl,
  };
}

