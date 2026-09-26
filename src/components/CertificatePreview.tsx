'use client';

import { VerificationCertificateData } from '../lib/certificate/types';
import { formatFileSize } from '../lib/media';

interface CertificatePreviewProps {
  data: VerificationCertificateData;
  qrSvg: string | null;
}

export function CertificatePreview({ data, qrSvg }: CertificatePreviewProps) {
  return (
    <div className="bg-black border border-gray-700 rounded-lg p-5 font-mono text-sm space-y-5 text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-800 pb-4">
        <div className="text-accent font-bold tracking-wider text-base">HASHDROP</div>
        <div className="text-lg font-bold text-primary mt-1">VERIFICATION CERTIFICATE</div>
        <div className="text-xs text-secondary mt-1">Certificate of Cryptographic & On-Chain Verification</div>
        <p className="text-xs text-gray-400 mt-2">
          This certificate records the successful verification of a HashDrop artifact against its associated cryptographic and blockchain evidence.
        </p>
      </div>

      {/* Status */}
      <div>
        <div className="text-xs text-secondary uppercase tracking-wider mb-1">Status</div>
        <div className="text-green-400 font-bold inline-flex items-center gap-1.5 bg-green-950/50 border border-green-800 px-2.5 py-1 rounded text-xs">
          <span>✓</span> VERIFIED
        </div>
      </div>

      {/* Artifact Information */}
      <div className="space-y-2 border-t border-gray-800 pt-3">
        <div className="text-xs font-semibold text-accent uppercase tracking-wider">Artifact Information</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-secondary">Certificate Reference:</dt>
            <dd className="text-accent font-mono break-all">{data.certificateId}</dd>
          </div>
          <div>
            <dt className="text-secondary">HashDrop ID:</dt>
            <dd className="text-accent font-mono break-all">{data.hashDropId}</dd>
          </div>
          <div>
            <dt className="text-secondary">Mode:</dt>
            <dd className="text-primary">{data.mode}</dd>
          </div>
          <div>
            <dt className="text-secondary">Content Type:</dt>
            <dd className="text-primary">{data.contentType}</dd>
          </div>
          <div>
            <dt className="text-secondary">Original Size:</dt>
            <dd className="text-primary">{data.originalSize} bytes ({formatFileSize(data.originalSize)})</dd>
          </div>
          {data.filename && (
            <div>
              <dt className="text-secondary">Filename:</dt>
              <dd className="text-accent break-all">{data.filename}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-secondary">SHA-256 (Content Hash):</dt>
            <dd className="text-accent font-mono break-all">{data.sha256}</dd>
          </div>
        </dl>
      </div>

      {/* Blockchain Evidence */}
      <div className="space-y-2 border-t border-gray-800 pt-3">
        <div className="text-xs font-semibold text-accent uppercase tracking-wider">Blockchain Evidence</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-secondary">Network:</dt>
            <dd className="text-primary">{data.network}</dd>
          </div>
          <div>
            <dt className="text-secondary">Blockchain:</dt>
            <dd className="text-primary">{data.blockchain}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-secondary">Transaction ID:</dt>
            <dd className="text-accent font-mono break-all">{data.transactionId}</dd>
          </div>
          {data.transactionVersion && (
            <div>
              <dt className="text-secondary">Transaction Version:</dt>
              <dd className="text-primary">{data.transactionVersion}</dd>
            </div>
          )}
          {data.signer && (
            <div>
              <dt className="text-secondary">Published By:</dt>
              <dd className="text-accent font-mono break-all">{data.signer}</dd>
            </div>
          )}
          {typeof data.slot === 'number' && (
            <div>
              <dt className="text-secondary">Block Slot:</dt>
              <dd className="text-primary">{data.slot}</dd>
            </div>
          )}
          <div>
            <dt className="text-secondary">On-chain Record Time:</dt>
            <dd className="text-primary">{data.onChainRecordTime || 'Not available'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-secondary">Solana Explorer:</dt>
            <dd>
              <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">
                {data.explorerUrl} ↗
              </a>
            </dd>
          </div>
        </dl>
      </div>
      {/* Verification Information */}
      <div className="space-y-2 border-t border-gray-800 pt-3">
        <div className="text-xs font-semibold text-accent uppercase tracking-wider">Verification Information</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-secondary">Verification Status:</dt>
            <dd className="text-green-400 font-bold">{data.verificationStatus}</dd>
          </div>
          <div>
            <dt className="text-secondary">Verified By HashDrop:</dt>
            <dd className="text-primary">{data.verifiedAt}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-secondary">Verification Method:</dt>
            <dd className="text-gray-300">{data.verificationMethod}</dd>
          </div>
        </dl>
      </div>

      {/* Cryptographic Information */}
      <div className="space-y-2 border-t border-gray-800 pt-3">
        <div className="text-xs font-semibold text-accent uppercase tracking-wider">Cryptographic Information</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-secondary">Hash Algorithm:</dt>
            <dd className="text-primary">{data.hashAlgorithm}</dd>
          </div>
          <div>
            <dt className="text-secondary">Protocol Version:</dt>
            <dd className="text-primary">{data.protocolVersion}</dd>
          </div>
          {data.cryptoVersion && (
            <div>
              <dt className="text-secondary">Crypto Version:</dt>
              <dd className="text-primary">{data.cryptoVersion}</dd>
            </div>
          )}
          {data.keyFingerprint && (
            <div>
              <dt className="text-secondary">Key Fingerprint:</dt>
              <dd className="text-accent font-mono break-all">{data.keyFingerprint}</dd>
            </div>
          )}
          {data.encryptionAlgorithm && (
            <div className="sm:col-span-2">
              <dt className="text-secondary">Encryption:</dt>
              <dd className="text-primary">{data.encryptionAlgorithm}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Explanations */}
      <div className="space-y-2 border-t border-gray-800 pt-3">
        <div className="text-xs font-semibold text-accent uppercase tracking-wider">Verification Explanations</div>
        <ul className="space-y-1.5 text-xs text-gray-400">
          {data.explanations.map((item, idx) => (
            <li key={idx}>
              <span className="text-secondary font-semibold">{item.term}:</span> {item.explanation}
            </li>
          ))}
        </ul>
      </div>

      {/* QR Code & Scan verification */}
      <div className="border-t border-gray-800 pt-4 flex flex-col sm:flex-row items-center gap-4">
        {qrSvg && (
          <div
            className="bg-white p-2 rounded shadow shrink-0"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}
        <div className="text-xs space-y-1 text-center sm:text-left">
          <div className="font-bold text-primary">Scan to verify this record on HashDrop</div>
          <div className="text-secondary break-all">{data.verificationUrl}</div>
          <div className="text-[11px] text-gray-500 pt-1">
            HashDrop verifies content and cryptographic integrity against the on-chain record. It does not establish copyright, authorship, or legal ownership.
          </div>
        </div>
      </div>

    </div>
  );
}
