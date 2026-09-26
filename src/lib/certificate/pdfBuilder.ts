/**
 * Minimal Client-Side PDF Generation (Standard PDF 1.4)
 * Pure TypeScript, zero external dependencies.
 */

export interface PdfTextLine {
  text: string;
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  color?: [number, number, number]; // RGB 0..1
}

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fillColor?: [number, number, number];
  strokeColor?: [number, number, number];
  lineWidth?: number;
}

function escapePdfText(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Build a simple, standards-compliant single-page PDF document.
 * Dimensions in standard points (72 points = 1 inch). A4 = 595 x 842 pt.
 */
export function buildSimplePdf(
  texts: PdfTextLine[],
  rects: PdfRect[] = [],
  qrMatrix?: boolean[][]
): Uint8Array {
  const width = 595;
  const height = 842;

  let streamContent = '';

  // Render background rects and lines
  for (const r of rects) {
    if (r.fillColor) {
      streamContent += `${r.fillColor[0].toFixed(3)} ${r.fillColor[1].toFixed(3)} ${r.fillColor[2].toFixed(3)} rg\n`;
    }
    if (r.strokeColor) {
      streamContent += `${r.strokeColor[0].toFixed(3)} ${r.strokeColor[1].toFixed(3)} ${r.strokeColor[2].toFixed(3)} RG\n`;
    }
    if (r.lineWidth) {
      streamContent += `${r.lineWidth.toFixed(1)} w\n`;
    }
    streamContent += `${r.x.toFixed(1)} ${r.y.toFixed(1)} ${r.w.toFixed(1)} ${r.h.toFixed(1)} re\n`;
    if (r.fillColor && r.strokeColor) {
      streamContent += `B\n`;
    } else if (r.fillColor) {
      streamContent += `f\n`;
    } else {
      streamContent += `S\n`;
    }
  }

  // Render QR Code if provided
  if (qrMatrix && qrMatrix.length > 0) {
    const matrixSize = qrMatrix.length;
    const qrSizePt = 90; // 90pt x 90pt
    const moduleSize = qrSizePt / matrixSize;
    const qrX = width - 40 - qrSizePt;
    const qrY = 40;

    // White background box for QR
    streamContent += `1 1 1 rg\n`;
    streamContent += `${(qrX - 5).toFixed(1)} ${(qrY - 5).toFixed(1)} ${(qrSizePt + 10).toFixed(1)} ${(qrSizePt + 10).toFixed(1)} re\nf\n`;

    // Dark modules
    streamContent += `0 0 0 rg\n`;
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (qrMatrix[r][c]) {
          const mx = qrX + c * moduleSize;
          const my = qrY + (matrixSize - 1 - r) * moduleSize;
          streamContent += `${mx.toFixed(2)} ${my.toFixed(2)} ${moduleSize.toFixed(2)} ${moduleSize.toFixed(2)} re\nf\n`;
        }
      }
    }
  }

  // Render texts
  for (const t of texts) {
    const font = t.bold ? '/F2' : '/F1';
    const color = t.color || [0.95, 0.95, 0.95];
    streamContent += `BT\n`;
    streamContent += `${font} ${t.size} Tf\n`;
    streamContent += `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg\n`;
    streamContent += `${t.x.toFixed(1)} ${t.y.toFixed(1)} Td\n`;
    streamContent += `(${escapePdfText(t.text)}) Tj\n`;
    streamContent += `ET\n`;
  }

  const streamBytes = new TextEncoder().encode(streamContent);
  const streamLen = streamBytes.length;

  const objects: string[] = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}endstream\nendobj\n`;
  objects[5] = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`;
  objects[6] = `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>\nendobj\n`;

  let pdfStr = `%PDF-1.4\n`;
  const offsets: number[] = [0];

  for (let i = 1; i <= 6; i++) {
    offsets[i] = new TextEncoder().encode(pdfStr).length;
    pdfStr += objects[i];
  }

  const xrefOffset = new TextEncoder().encode(pdfStr).length;
  pdfStr += `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) {
    pdfStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfStr += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdfStr);
}
