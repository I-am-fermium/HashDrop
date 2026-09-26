/**
 * HashDrop Minimal Standalone QR Code Generator - Part 1
 *
 * Implements ISO/IEC 18004 QR Code Model 2 (Version 1-10, Byte mode, Error Correction Level M).
 * Pure TypeScript, zero external dependencies.
 */

export const PAD_BYTES = [0xec, 0x11];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = val;
    EXP[i + 255] = val;
    LOG[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  LOG[0] = 0;
})();

export function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP[LOG[x] + LOG[y]];
}

export function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

export function getGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

export function calculateEcCodewords(data: number[], numEc: number): number[] {
  const gen = getGeneratorPoly(numEc);
  const msg = [...data, ...new Array(numEc).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = msg[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return msg.slice(data.length);
}

export interface VersionInfo {
  version: number;
  size: number;
  totalCodewords: number;
  dataCodewords: number;
  ecPerBlock: number;
  group1Blocks: number;
  group1Data: number;
  group2Blocks: number;
  group2Data: number;
  alignmentPatterns: number[];
}

export const VERSION_TABLE: VersionInfo[] = [
  { version: 1, size: 21, totalCodewords: 26, dataCodewords: 16, ecPerBlock: 10, group1Blocks: 1, group1Data: 16, group2Blocks: 0, group2Data: 0, alignmentPatterns: [] },
  { version: 2, size: 25, totalCodewords: 44, dataCodewords: 28, ecPerBlock: 16, group1Blocks: 1, group1Data: 28, group2Blocks: 0, group2Data: 0, alignmentPatterns: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, dataCodewords: 44, ecPerBlock: 26, group1Blocks: 1, group1Data: 44, group2Blocks: 0, group2Data: 0, alignmentPatterns: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, dataCodewords: 64, ecPerBlock: 18, group1Blocks: 2, group1Data: 32, group2Blocks: 0, group2Data: 0, alignmentPatterns: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, dataCodewords: 86, ecPerBlock: 24, group1Blocks: 2, group1Data: 43, group2Blocks: 0, group2Data: 0, alignmentPatterns: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, dataCodewords: 108, ecPerBlock: 16, group1Blocks: 4, group1Data: 27, group2Blocks: 0, group2Data: 0, alignmentPatterns: [6, 34] },
  { version: 7, size: 45, totalCodewords: 196, dataCodewords: 124, ecPerBlock: 18, group1Blocks: 4, group1Data: 31, group2Blocks: 0, group2Data: 0, alignmentPatterns: [6, 22, 38] },
  { version: 8, size: 49, totalCodewords: 242, dataCodewords: 154, ecPerBlock: 22, group1Blocks: 2, group1Data: 38, group2Blocks: 2, group2Data: 39, alignmentPatterns: [6, 24, 42] },
  { version: 9, size: 53, totalCodewords: 292, dataCodewords: 182, ecPerBlock: 22, group1Blocks: 3, group1Data: 36, group2Blocks: 2, group2Data: 37, alignmentPatterns: [6, 26, 46] },
  { version: 10, size: 57, totalCodewords: 346, dataCodewords: 216, ecPerBlock: 26, group1Blocks: 4, group1Data: 40, group2Blocks: 1, group2Data: 41, alignmentPatterns: [6, 28, 50] },
];
