/**
 * Tests for HashDrop Memo Module (V2 only, v1 transactions)
 */

import {
  encodeMemoPayload,
  decodeMemoPayload,
  isValidMemoPayload,
  canFitInMemo,
  MEMO_PROGRAM_ID,
  LEGACY_TRANSACTION_MAX_BYTES,
  V1_TRANSACTION_MAX_BYTES,
  getMaxContentSize,
  calculateTransactionSize,
} from './memo';

describe('Memo Module', () => {
  describe('encodeMemoPayload', () => {
    it('should encode V2 payload correctly', () => {
      const result = encodeMemoPayload(
        'hd_abc12345',
        'hash1234567890abcdef',
        'text/plain',
        100,
        'SGVsbG8sIFdvcmxk'
      );
      expect(result).toBe('HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk');
    });

    it('should handle unicode content', () => {
      const result = encodeMemoPayload(
        'hd_abc12345',
        'hash1234567890abcdef',
        'text/plain',
        10,
        'SGVsbG8sIEhhc2g=' // "Hello, Hash" in base64
      );
      expect(result).toContain('HASHDROP|v2|MEMO|');
    });
  });

  describe('decodeMemoPayload', () => {
    it('should decode valid V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk';
      const result = decodeMemoPayload(payload);
      
      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v2');
      expect(result?.type).toBe('MEMO');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe('hash1234567890abcdef');
      expect(result?.contentType).toBe('text/plain');
      expect(result?.contentSize).toBe(100);
      expect(result?.content).toBe('SGVsbG8sIFdvcmxk');
    });

    it('should return null for invalid payload', () => {
      expect(decodeMemoPayload('invalid')).toBeNull();
      expect(decodeMemoPayload('HASHDROP|v1|...')).toBeNull(); // wrong version
      expect(decodeMemoPayload('OTHER|v2|MEMO|...')).toBeNull(); // wrong protocol
    });

    it('should handle malformed size', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|abc|SGVsbG8=';
      expect(decodeMemoPayload(payload)).toBeNull();
    });
  });

  describe('isValidMemoPayload', () => {
    it('should validate correct V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
      expect(isValidMemoPayload(payload)).toBe(true);
    });

    it('should reject invalid payload', () => {
      expect(isValidMemoPayload('invalid')).toBe(false);
    });
  });

  describe('canFitInMemo', () => {
    it('should return true for small content', () => {
      expect(canFitInMemo('Hello, World!')).toBe(true);
    });

    it('should return true for medium content (v1 supports up to ~2800 bytes of raw content)', () => {
      // With 4096 bytes limit and ~176 bytes overhead, content up to ~2800 bytes should fit
      // (base64 encoding increases size by ~33%, so 2800 * 4/3 = ~3733 + ~176 = ~3909 < 4096)
      const mediumContent = 'x'.repeat(2500);
      expect(canFitInMemo(mediumContent)).toBe(true);
    });

    it('should return false for large content that exceeds v1 limits', () => {
      // Content that's too large for v1 (base64 encoding + overhead exceeds 4096)
      const largeContent = 'x'.repeat(3000);
      expect(canFitInMemo(largeContent)).toBe(false);
    });

    it('should handle unicode correctly', () => {
      const unicodeContent = '你好世界🚀';
      expect(canFitInMemo(unicodeContent)).toBe(true);
    });

    it('should use v1 transaction limits (4096 bytes)', () => {
      // With 4096 bytes limit, content should fit
      expect(canFitInMemo('Hello, World!')).toBe(true);
      // Content that's too large for v1
      const largeContent = 'x'.repeat(3000);
      expect(canFitInMemo(largeContent)).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have correct Memo program ID', () => {
      expect(MEMO_PROGRAM_ID).toBe('Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH');
    });

    it('should have correct transaction size limits', () => {
      expect(LEGACY_TRANSACTION_MAX_BYTES).toBe(1232);
      expect(V1_TRANSACTION_MAX_BYTES).toBe(4096);
    });
  });

  describe('getMaxContentSize', () => {
    it('should calculate max content size for v1 transactions', () => {
      const maxSize = getMaxContentSize();
      expect(maxSize).toBeGreaterThan(2500);
      expect(maxSize).toBeLessThan(4096);
    });
  });

  describe('calculateTransactionSize', () => {
    it('should calculate transaction size correctly', () => {
      const content = 'Hello, HashDrop!';
      const result = calculateTransactionSize(content);
      
      expect(result.contentBytes).toBe(content.length);
      expect(result.transactionBytes).toBeGreaterThan(0);
      expect(result.maxTransactionBytes).toBe(4096);
      expect(result.availableBytes).toBeGreaterThan(0);
    });

    it('should show negative available bytes for content that is too large', () => {
      // Content that exceeds v1 transaction limits
      const largeContent = 'x'.repeat(3000);
      const result = calculateTransactionSize(largeContent);
      
      expect(result.availableBytes).toBeLessThan(0);
    });
  });
});