/**
 * HashDrop Minimal Standalone QR Code Matrix & SVG Generator
 */

import {
  VERSION_TABLE,
  calculateEcCodewords,
  PAD_BYTES,
  VersionInfo,
} from './qrTable';

class BitBuffer {
  private buffer: number[] = [];
  private length: number = 0;

  put(num: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) {
      this.putBit(((num >>> i) & 1) === 1);
    }
  }

  putBit(bit: boolean): void {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }

  getLength(): number {
    return this.length;
  }

  getBytes(): number[] {
    return this.buffer;
  }
}

export function encodeDataCodewords(text: string): { vInfo: VersionInfo; codewords: number[] } {
  const bytes = new TextEncoder().encode(text);
  const dataLen = bytes.length;

  let vInfo: VersionInfo | null = null;
  for (const v of VERSION_TABLE) {
    const countBits = v.version < 10 ? 8 : 16;
    const requiredBits = 4 + countBits + dataLen * 8;
    const requiredBytes = Math.ceil(requiredBits / 8);
    if (requiredBytes <= v.dataCodewords) {
      vInfo = v;
      break;
    }
  }

  if (!vInfo) {
    throw new Error('Data too long for QR code generator (exceeds Version 10-M capacity)');
  }

  const bitBuffer = new BitBuffer();
  bitBuffer.put(0x4, 4);
  bitBuffer.put(dataLen, vInfo.version < 10 ? 8 : 16);
  for (let i = 0; i < dataLen; i++) {
    bitBuffer.put(bytes[i], 8);
  }

  const remainingBits = vInfo.dataCodewords * 8 - bitBuffer.getLength();
  bitBuffer.put(0, Math.min(4, remainingBits));

  while (bitBuffer.getLength() % 8 !== 0) {
    bitBuffer.putBit(false);
  }

  const dataBytes = bitBuffer.getBytes();
  let padIdx = 0;
  while (dataBytes.length < vInfo.dataCodewords) {
    dataBytes.push(PAD_BYTES[padIdx % 2]);
    padIdx++;
  }

  const numBlocks = vInfo.group1Blocks + vInfo.group2Blocks;
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let byteOffset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockSize = b < vInfo.group1Blocks ? vInfo.group1Data : vInfo.group2Data;
    const blockData = dataBytes.slice(byteOffset, byteOffset + blockSize);
    byteOffset += blockSize;
    blocks.push(blockData);
    ecBlocks.push(calculateEcCodewords(blockData, vInfo.ecPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(vInfo.group1Data, vInfo.group2Data);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < blocks[b].length) {
        finalCodewords.push(blocks[b][i]);
      }
    }
  }

  for (let i = 0; i < vInfo.ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  return { vInfo, codewords: finalCodewords };
}
