/**
 * Tests for HashDrop Protocol Module (V3 only)
 */

import {
  encodePublicPayload,
  decodePublicPayload,
  isValidPublicPayload,
  canFitInMemo,
  MEMO_PROGRAM_ID,
  LEGACY_TRANSACTION_MAX_BYTES,
  V1_TRANSACTION_MAX_BYTES,
  getMaxContentSize,
  calculateTransactionSize,
  HASHDROP_VERSION,
} from './memo';

describe('Protocol Module', () => {
  describe('encodePublicPayload', () => {
    it('should encode V3 PUBLIC payload correctly', () => {
      const result = encodePublicPayload(
        'hd_abc12345',
        'hash1234567890abcdef',
        'text/plain',
        100,
        'SGVsbG8sIFdvcmxk'
      );
      expect(result).toBe('HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk');
    });

    it('should handle unicode content', () => {
      const result = encodePublicPayload(
        'hd_abc12345',
        'hash1234567890abcdef',
        'text/plain',
        10,
        'SGVsbG8sIEhhc2g=' // "Hello, Hash" in base64
      );
      expect(result).toContain('HASHDROP|v3|PUBLIC|');
    });
  });

  describe('decodePublicPayload', () => {
    it('should decode valid V3 PUBLIC payload', () => {
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8sIFdvcmxk';
      const result = decodePublicPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('HASHDROP');
      expect(result?.version).toBe('v3');
      expect(result?.mode).toBe('PUBLIC');
      expect(result?.hashDropId).toBe('hd_abc12345');
      expect(result?.contentHash).toBe('hash1234567890abcdef');
      expect(result?.contentType).toBe('text/plain');
      expect(result?.contentSize).toBe(100);
      expect(result?.content).toBe('SGVsbG8sIFdvcmxk');
    });

    it('should return null for invalid payload', () => {
      expect(decodePublicPayload('invalid')).toBeNull();
      expect(decodePublicPayload('HASHDROP|v2|...')).toBeNull(); // wrong version
      expect(decodePublicPayload('OTHER|v3|PUBLIC|...')).toBeNull(); // wrong protocol
    });

    it('should handle malformed size', () => {
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|abc|SGVsbG8=';
      expect(decodePublicPayload(payload)).toBeNull();
    });

    it('should reject V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
      expect(decodePublicPayload(payload)).toBeNull();
    });
  });

  describe('isValidPublicPayload', () => {
    it('should validate correct V3 PUBLIC payload', () => {
      const payload = 'HASHDROP|v3|PUBLIC|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
      expect(isValidPublicPayload(payload)).toBe(true);
    });

    it('should reject invalid payload', () => {
      expect(isValidPublicPayload('invalid')).toBe(false);
    });

    it('should reject V2 payload', () => {
      const payload = 'HASHDROP|v2|MEMO|hd_abc12345|hash1234567890abcdef|text/plain|100|SGVsbG8=';
      expect(isValidPublicPayload(payload)).toBe(false);
    });
  });

  describe('protocol version', () => {
    it('should have correct version', () => {
      expect(HASHDROP_VERSION).toBe('v3');
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