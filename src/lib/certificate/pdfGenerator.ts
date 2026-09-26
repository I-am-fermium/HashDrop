/**
 * HashDrop PDF Certificate Generator
 */

import { VerificationCertificateData } from './types';
import { buildSimplePdf, PdfTextLine, PdfRect } from './pdfBuilder';
import { generateQrMatrix } from './qr';
import { formatFileSize } from '../media';

/**
 * Wrap text cleanly to fit within maxChars characters per line.
 * Break words on spaces, and split long words that exceed maxChars.
 */
function wrapPdfText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }

    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxChars) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function generateCertificatePdf(cert: VerificationCertificateData): Uint8Array {
  const texts: PdfTextLine[] = [];
  const rects: PdfRect[] = [];

  // Dark background matching HashDrop dark theme
  rects.push({
    x: 0,
    y: 0,
    w: 595,
    h: 842,
    fillColor: [0.04, 0.04, 0.05], // #0a0a0d
  });

  // Inner border container
  rects.push({
    x: 20,
    y: 20,
    w: 555,
    h: 802,
    strokeColor: [0.22, 0.22, 0.25], // border gray
    lineWidth: 1,
  });

  // Top accent bar (HashDrop red #ff4757)
  rects.push({
    x: 20,
    y: 818,
    w: 555,
    h: 4,
    fillColor: [1.0, 0.28, 0.34],
  });

  let currentY = 790;

  // Header branding
  texts.push({
    text: 'HASHDROP',
    x: 40,
    y: currentY,
    size: 16,
    bold: true,
    color: [1.0, 0.28, 0.34],
  });

  texts.push({
    text: 'VERIFICATION CERTIFICATE',
    x: 40,
    y: currentY - 20,
    size: 14,
    bold: true,
    color: [0.95, 0.95, 0.95],
  });

  texts.push({
    text: 'Certificate of Cryptographic & On-Chain Verification',
    x: 40,
    y: currentY - 36,
    size: 9,
    bold: false,
    color: [0.65, 0.65, 0.68],
  });

  currentY -= 65;

  // Status Badge
  rects.push({
    x: 40,
    y: currentY - 6,
    w: 515,
    h: 28,
    fillColor: [0.06, 0.18, 0.1],
    strokeColor: [0.2, 0.6, 0.3],
    lineWidth: 1,
  });

  texts.push({
    text: '[VERIFIED] Content Integrity & Cryptographic Record Verified',
    x: 52,
    y: currentY + 4,
    size: 10,
    bold: true,
    color: [0.3, 0.9, 0.45],
  });

  currentY -= 40;

  const addSectionHeader = (title: string) => {
    texts.push({
      text: title,
      x: 40,
      y: currentY,
      size: 10,
      bold: true,
      color: [1.0, 0.28, 0.34],
    });
    rects.push({
      x: 40,
      y: currentY - 4,
      w: 515,
      h: 0.5,
      strokeColor: [0.25, 0.25, 0.28],
      lineWidth: 0.5,
    });
    currentY -= 18;
  };

  const addField = (label: string, value: string, isMono: boolean = false) => {
    texts.push({
      text: `${label}:`,
      x: 40,
      y: currentY,
      size: 8,
      bold: true,
      color: [0.65, 0.65, 0.68],
    });

    // Handle wrapping for long hashes or transaction signatures
    if (value.length > 55) {
      const part1 = value.slice(0, 55);
      const part2 = value.slice(55);
      texts.push({
        text: part1,
        x: 160,
        y: currentY,
        size: 7.5,
        bold: false,
        color: isMono ? [1.0, 0.35, 0.4] : [0.92, 0.92, 0.92],
      });
      currentY -= 11;
      texts.push({
        text: part2,
        x: 160,
        y: currentY,
        size: 7.5,
        bold: false,
        color: isMono ? [1.0, 0.35, 0.4] : [0.92, 0.92, 0.92],
      });
    } else {
      texts.push({
        text: value,
        x: 160,
        y: currentY,
        size: 8,
        bold: false,
        color: isMono ? [1.0, 0.35, 0.4] : [0.92, 0.92, 0.92],
      });
    }
    currentY -= 14;
  };

  // 1. Artifact Information
  addSectionHeader('ARTIFACT INFORMATION');
  addField('HashDrop ID', cert.hashDropId, true);
  addField('Mode', cert.mode);
  addField('Content Type', cert.contentType);
  addField('Original Size', `${cert.originalSize} bytes (${formatFileSize(cert.originalSize)})`);
  if (cert.filename) {
    addField('Filename', cert.filename);
  }
  addField('SHA-256', cert.sha256, true);

  currentY -= 6;

  // 2. Network & Blockchain Evidence
  addSectionHeader('BLOCKCHAIN EVIDENCE');
  addField('Network', cert.network);
  addField('Blockchain', cert.blockchain);
  addField('Transaction ID', cert.transactionId, true);
  if (cert.transactionVersion) {
    addField('Tx Version', cert.transactionVersion);
  }
  if (cert.signer) {
    addField('Published By', cert.signer, true);
  }
  if (typeof cert.slot === 'number') {
    addField('Block Slot', String(cert.slot));
  }
  addField('On-Chain Record Time', cert.onChainRecordTime || 'Not available');
  addField('Solana Explorer', cert.explorerUrl);

  currentY -= 6;

  // 3. Cryptographic Verification
  addSectionHeader('CRYPTOGRAPHIC INFORMATION');
  addField('Verification Status', cert.verificationStatus);
  addField('Verified By HashDrop', cert.verifiedAt);
  addField('Hash Algorithm', cert.hashAlgorithm);
  addField('Protocol Version', cert.protocolVersion);
  if (cert.cryptoVersion) {
    addField('Crypto Version', cert.cryptoVersion);
  }
  if (cert.keyFingerprint) {
    addField('Key Fingerprint', cert.keyFingerprint, true);
  }
  if (cert.encryptionAlgorithm) {
    addField('Encryption', cert.encryptionAlgorithm);
  }

  currentY -= 6;

  // 4. Verification Explanation
  addSectionHeader('VERIFICATION EXPLANATIONS');
  for (const exp of cert.explanations) {
    const fullText = `* ${exp.term}: ${exp.explanation}`;
    const wrappedLines = wrapPdfText(fullText, 114);
    for (let i = 0; i < wrappedLines.length; i++) {
      texts.push({
        text: wrappedLines[i],
        x: i === 0 ? 40 : 48, // Indent continuation lines cleanly
        y: currentY,
        size: 7,
        color: [0.65, 0.65, 0.68],
      });
      currentY -= 9.5;
    }
    currentY -= 1.5; // subtle gap between bullet items
  }

  // Footer notes & QR code section
  // Layout separation:
  // LEFT COLUMN (x: 40 to 420): Caption, Verification URL, and Disclaimers
  // RIGHT COLUMN (x: 450 to 555): Dedicated QR bounding box
  texts.push({
    text: 'Scan to verify this record on HashDrop:',
    x: 40,
    y: 115,
    size: 7.5,
    bold: true,
    color: [0.65, 0.65, 0.68],
  });
  texts.push({
    text: cert.verificationUrl.slice(0, 60),
    x: 40,
    y: 102,
    size: 7,
    color: [1.0, 0.28, 0.34],
  });
  texts.push({
    text: 'This certificate verifies cryptographic & content integrity relative to',
    x: 40,
    y: 75,
    size: 6.5,
    color: [0.55, 0.55, 0.58],
  });
  texts.push({
    text: 'the recorded on-chain HashDrop record.',
    x: 40,
    y: 65,
    size: 6.5,
    color: [0.55, 0.55, 0.58],
  });
  texts.push({
    text: 'HashDrop makes no claim of legal copyright, authorship, or ownership.',
    x: 40,
    y: 52,
    size: 6.5,
    color: [0.45, 0.45, 0.48],
  });

  // Generate QR Matrix for the public verification URL
  let qrMatrix: boolean[][] | undefined;
  try {
    qrMatrix = generateQrMatrix(cert.verificationUrl);
  } catch {
    // If URL exceeds QR capacity, QR is safely omitted without failing PDF generation
  }

  return buildSimplePdf(texts, rects, qrMatrix);
}
