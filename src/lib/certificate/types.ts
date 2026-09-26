/**
 * HashDrop Verification Certificate Types
 *
 * Types for certificate-safe presentation of verified HashDrop artifacts.
 */

export interface VerificationExplanationItem {
  term: string;
  explanation: string;
}

export interface VerificationCertificateData {
  // Gate check: certificate MUST only represent an existing, verified record
  verified: true;

  // Artifact Identifiers & Content Metadata
  certificateId: string; // Deterministic reference ID (HashDrop ID)
  hashDropId: string;
  mode: 'PUBLIC' | 'PROOF' | 'PRIVATE';
  contentType: string; // MIME type or logical content type
  mimeType?: string;
  originalSize: number;
  filename?: string;
  sha256: string; // Committed SHA-256 hash

  // Network & Blockchain Evidence
  network: string; // Devnet / Mainnet (Beta)
  blockchain: string; // "Solana"
  transactionId: string; // Solana transaction signature (Base58, 64-byte)
  transactionVersion?: 'legacy' | 'v0' | 'v1';
  signer?: string; // Publisher / fee payer wallet address
  slot?: number; // On-chain block slot if available
  onChainRecordTime: string | null; // Blockchain timestamp if available, null ("Not available") otherwise
  explorerUrl: string;

  // Verification Metadata
  verificationStatus: 'Verified';
  verifiedAt: string; // ISO 8601 string of client verification time
  verificationMethod: string; // Description of cryptographic & on-chain verification method

  // Cryptographic Evidence (only fields that genuinely exist in verified result)
  hashAlgorithm: string; // "SHA-256"
  protocolVersion: string; // e.g., "v3"
  cryptoVersion?: string; // e.g., "HD-P2" (PRIVATE mode)
  keyFingerprint?: string; // ML-KEM public key fingerprint (safe public identifier)
  encryptionAlgorithm?: string; // "AES-256-GCM + ML-KEM-768 + HKDF-SHA-256" for PRIVATE

  // Educational explanations of fields actually present
  explanations: VerificationExplanationItem[];

  // Verification & Share URLs
  verificationUrl: string;
}
