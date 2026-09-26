/**
 * HashDrop Minimal Standalone QR Code Matrix & SVG Generator
 */

import { encodeDataCodewords } from './qrEncode';

export function generateQrMatrix(text: string): boolean[][] {
  const { vInfo, codewords } = encodeDataCodewords(text);
  const size = vInfo.size;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          isFunction[nr][nc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            matrix[nr][nc] = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  };

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      isFunction[6][i] = true;
      matrix[6][i] = i % 2 === 0;
    }
    if (!isFunction[i][6]) {
      isFunction[i][6] = true;
      matrix[i][6] = i % 2 === 0;
    }
  }

  const alignPos = vInfo.alignmentPatterns;
  if (alignPos.length > 0) {
    for (const r of alignPos) {
      for (const c of alignPos) {
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === alignPos[alignPos.length - 1] && c > size - 10) ||
          (c === 6 && r === alignPos[alignPos.length - 1] && r > size - 10)
        ) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            isFunction[nr][nc] = true;
            matrix[nr][nc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          }
        }
      }
    }
  }

  isFunction[4 * vInfo.version + 9][8] = true;
  matrix[4 * vInfo.version + 9][8] = true;

  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
    if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = true;
    if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i][8] = true;
  }

  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const upward = ((size - 1 - right) / 2) % 2 === 0;
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = right - colOffset;
        if (!isFunction[row][col]) {
          let bit = false;
          if (bitIdx < totalBits) {
            const byteVal = codewords[Math.floor(bitIdx / 8)];
            bit = ((byteVal >>> (7 - (bitIdx % 8))) & 1) === 1;
            bitIdx++;
          }
          matrix[row][col] = bit;
        }
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c] && matrix[r][c] !== null) {
        if ((r + c) % 2 === 0) {
          matrix[r][c] = !matrix[r][c];
        }
      }
    }
  }

  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const formatCoordsTL: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatCoordsTL[i];
    matrix[r][c] = formatBits[i] === 1;
  }

  for (let i = 0; i < 8; i++) {
    matrix[size - 1 - i][8] = formatBits[i] === 1;
  }
  for (let i = 8; i < 15; i++) {
    matrix[8][size - 15 + i] = formatBits[i] === 1;
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}

/**
 * Generate a standalone SVG string for the QR code.
 */
export function generateQrSvg(text: string, sizePx: number = 200, margin: number = 4): string {
  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const totalModules = matrixSize + margin * 2;

  let pathData = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + margin;
        const y = r + margin;
        pathData += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<path d="${pathData.trim()}" fill="#0a0a0a"/>` +
    `</svg>`
  );
}
