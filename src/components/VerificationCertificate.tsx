'use client';

import { useState, useCallback, useMemo } from 'react';
import { VerificationCertificateData } from '../lib/certificate/types';
import { generateCertificatePdf } from '../lib/certificate/pdfGenerator';
import { generateQrSvg } from '../lib/certificate/qr';
import { downloadBytesFile } from '../lib/download';
import { formatFileSize } from '../lib/media';
import { CertificatePreview } from './CertificatePreview';

interface VerificationCertificateProps {
  data: VerificationCertificateData;
}

export function VerificationCertificate({ data }: VerificationCertificateProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleDownloadPdf = useCallback(() => {
    if (!data?.verified) return;
    try {
      const pdfBytes = generateCertificatePdf(data);
      const filename = `hashdrop-certificate-${data.certificateId}.pdf`;
      downloadBytesFile(filename, pdfBytes, 'application/pdf');
    } catch (e) {
      console.error('[HashDrop Certificate] PDF generation failed:', e);
    }
  }, [data]);

  const handleShare = useCallback(async () => {
    if (!data?.verified) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `HashDrop Verification Certificate - ${data.certificateId}`,
          text: `Verified HashDrop record for ${data.hashDropId} on Solana ${data.network}`,
          url: data.verificationUrl,
        });
        return;
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }

    // Safe fallback: copy verification URL to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(data.verificationUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } catch (err) {
        console.error('[HashDrop Certificate] Clipboard copy failed:', err);
      }
    }
  }, [data]);

  const qrSvg = useMemo(() => {
    if (!data?.verified) return null;
    try {
      return generateQrSvg(data.verificationUrl, 120, 2);
    } catch {
      return null;
    }
  }, [data]);

  // Failure-closed gate: Never render or generate certificate if unverified
  if (!data || !data.verified) {
    return null;
  }

  return (
    <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Verification Certificate</h2>
          <p className="text-sm text-secondary mt-1">
            Generate a formal certificate containing the cryptographic and blockchain evidence associated with this verification.
          </p>
        </div>
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="whitespace-nowrap px-4 py-2 bg-accent text-white font-bold rounded hover:opacity-90 transition text-sm self-start sm:self-auto"
          >
            Generate Certificate
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-6 border-t border-gray-800 pt-6">
          <CertificatePreview data={data} qrSvg={qrSvg} />

          {/* Action Buttons: Download PDF & Share */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-accent text-white font-bold rounded hover:opacity-90 transition text-sm flex items-center gap-1.5"
            >
              <span>↓</span> Download Certificate (PDF)
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="px-4 py-2 bg-gray-700 text-primary font-bold rounded hover:opacity-90 transition text-sm flex items-center gap-1.5"
            >
              <span>↗</span> {copySuccess ? '✓ Link Copied!' : 'Share Certificate'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default VerificationCertificate;
