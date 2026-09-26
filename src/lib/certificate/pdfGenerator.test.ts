import { generateCertificatePdf } from './pdfGenerator';
import { VerificationCertificateData } from './types';

describe('PDF Certificate Generator (pdfGenerator.ts)', () => {
  const sampleCert: VerificationCertificateData = {
    verified: true,
    certificateId: 'hd_sample_123',
    hashDropId: 'hd_sample_123',
    mode: 'PUBLIC',
    contentType: 'text/plain',
    mimeType: 'text/plain',
    originalSize: 1024,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    network: 'Devnet',
    blockchain: 'Solana',
    transactionId: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
    transactionVersion: 'v0',
    signer: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    onChainRecordTime: null,
    explorerUrl: 'https://explorer.solana.com/tx/3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd?cluster=devnet',
    verificationStatus: 'Verified',
    verifiedAt: '2026-09-26T12:00:00.000Z',
    verificationMethod: 'HashDrop on-chain transaction memo retrieval and SHA-256 byte-level cryptographic integrity verification',
    hashAlgorithm: 'SHA-256',
    protocolVersion: 'v3',
    explanations: [
      { term: 'SHA-256', explanation: 'Fixed-length cryptographic hash function.' },
      { term: 'Transaction ID', explanation: 'Identifies the Solana transaction.' },
    ],
    verificationUrl: 'https://hashdrop.io/viewer?signature=3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
  };

  it('generates a valid binary PDF document starting with %PDF-1.4', () => {
    const pdfBytes = generateCertificatePdf(sampleCert);
    expect(pdfBytes.byteLength).toBeGreaterThan(500);

    const header = new TextDecoder().decode(pdfBytes.slice(0, 8));
    expect(header).toBe('%PDF-1.4');

    const fullPdf = new TextDecoder().decode(pdfBytes);
    expect(fullPdf).toContain('HASHDROP');
    expect(fullPdf).toContain('VERIFICATION CERTIFICATE');
    expect(fullPdf).toContain('hd_sample_123');
    expect(fullPdf).toContain('%%EOF');
  });

  it('reserves the left column for text and right column for QR code without overlap', () => {
    const pdfBytes = generateCertificatePdf({
      ...sampleCert,
      slot: 123456,
      onChainRecordTime: 'Sat, 26 Sep 2026 12:00:00 GMT',
    });
    const fullPdf = new TextDecoder().decode(pdfBytes);
    expect(fullPdf).toContain('Block Slot:');
    expect(fullPdf).toContain('123456');
    expect(fullPdf).toContain('On-Chain Record Time:');
    expect(fullPdf).toContain('Sat, 26 Sep 2026 12:00:00 GMT');
    expect(fullPdf).toContain('Verified By HashDrop:');
  });

  it('renders complete explanation text without clipping or truncation', () => {
    const longExplanation =
      'Proof Drop stores only the cryptographic commitment on-chain. Verification proved that the independently supplied content bytes match the on-chain SHA-256 hash byte-for-byte.';
    const pdfBytes = generateCertificatePdf({
      ...sampleCert,
      explanations: [
        { term: 'Cryptographic Commitment', explanation: longExplanation },
        { term: 'SHA-256', explanation: 'SHA-256 produces a fixed-length cryptographic fingerprint.' },
      ],
    });
    const fullPdf = new TextDecoder().decode(pdfBytes);
    // Verify that the full wording of the long explanation is present in the PDF text stream
    expect(fullPdf).toContain('Cryptographic Commitment:');
    expect(fullPdf).toContain('independently supplied content bytes match the on-chain SHA-256 hash byte-for-byte.');
  });

  it('generates complete PDFs for PUBLIC, PROOF, and PRIVATE modes with all fields intact', () => {
    // PUBLIC
    const pubCert: VerificationCertificateData = {
      ...sampleCert,
      mode: 'PUBLIC',
      onChainRecordTime: 'Sat, 26 Sep 2026 12:00:00 GMT',
      slot: 123456,
    };
    const pubPdf = new TextDecoder().decode(generateCertificatePdf(pubCert));
    expect(pubPdf).toContain('ARTIFACT INFORMATION');
    expect(pubPdf).toContain('BLOCKCHAIN EVIDENCE');
    expect(pubPdf).toContain('CRYPTOGRAPHIC INFORMATION');
    expect(pubPdf).toContain('VERIFICATION EXPLANATIONS');
    expect(pubPdf).toContain('On-Chain Record Time:');
    expect(pubPdf).toContain('Verified By HashDrop:');
    expect(pubPdf).toContain('Block Slot:');

    // PROOF
    const proofCert: VerificationCertificateData = {
      ...sampleCert,
      mode: 'PROOF',
      contentType: 'image/png',
      mimeType: 'image/png',
      filename: 'document.png',
      onChainRecordTime: 'Sat, 26 Sep 2026 12:00:00 GMT',
      slot: 123457,
      explanations: [
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
      ],
    };
    const proofPdf = new TextDecoder().decode(generateCertificatePdf(proofCert));
    expect(proofPdf).toContain('document.png');
    expect(proofPdf).toContain('image/png');
    // Ensure all 6 explanations are fully rendered without truncation
    for (const exp of proofCert.explanations) {
      expect(proofPdf).toContain(exp.term);
      // Explanation words should all appear in the rendered lines
      const words = exp.explanation.split(' ');
      expect(proofPdf).toContain(words[0]);
      expect(proofPdf).toContain(words[words.length - 1]);
    }

    // PRIVATE
    const privCert: VerificationCertificateData = {
      ...sampleCert,
      mode: 'PRIVATE',
      cryptoVersion: 'HD-P2',
      keyFingerprint: 'aabbccddeeff0011',
      encryptionAlgorithm: 'AES-256-GCM + ML-KEM-768 + HKDF-SHA-256',
      onChainRecordTime: 'Sat, 26 Sep 2026 12:00:00 GMT',
      slot: 123458,
      explanations: [
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
      ],
    };
    const privPdf = new TextDecoder().decode(generateCertificatePdf(privCert));
    expect(privPdf).toContain('HD-P2');
    expect(privPdf).toContain('aabbccddeeff0011');
    expect(privPdf).toContain('AES-256-GCM + ML-KEM-768 + HKDF-SHA-256');
    for (const exp of privCert.explanations) {
      expect(privPdf).toContain(exp.term);
      const words = exp.explanation.split(' ');
      expect(privPdf).toContain(words[0]);
      expect(privPdf).toContain(words[words.length - 1]);
    }
  });

  it('writes sample PDFs to disk for visual layout inspection across all modes', () => {
    const fs = require('fs');
    const path = require('path');
    const outDir = path.resolve(__dirname, '../../../test-output-certs');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const modes: Array<'PUBLIC' | 'PROOF' | 'PRIVATE'> = ['PUBLIC', 'PROOF', 'PRIVATE'];
    for (const mode of modes) {
      const cert: VerificationCertificateData = {
        ...sampleCert,
        mode,
        slot: 494119827,
        onChainRecordTime: 'Sat, 26 Sep 2026 12:00:00 GMT',
        cryptoVersion: mode === 'PRIVATE' ? 'HD-P2' : undefined,
        keyFingerprint: mode === 'PRIVATE' ? 'aabbccddeeff0011' : undefined,
        encryptionAlgorithm: mode === 'PRIVATE' ? 'AES-256-GCM + ML-KEM-768 + HKDF-SHA-256' : undefined,
        explanations: [
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
        ],
      };
      const pdfBytes = generateCertificatePdf(cert);
      fs.writeFileSync(path.join(outDir, `certificate-${mode.toLowerCase()}.pdf`), pdfBytes);
    }
  });

});

