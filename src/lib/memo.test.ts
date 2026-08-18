/**
 * Tests for HashDrop Memo Module (V2 only)
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

    it('should return false for large content', () => {
      const largeContent = 'x'.repeat(1500);
      expect(canFitInMemo(largeContent)).toBe(false);
    });

    it('should handle unicode correctly', () => {
      const unicodeContent = '你好世界🚀';
      expect(canFitInMemo(unicodeContent)).toBe(true);
    });

    it('should respect custom max transaction bytes', () => {
      // With 1232 bytes limit, content should fit
      expect(canFitInMemo('Hello, World!', 1232)).toBe(true);
      // With 4096 bytes limit, content up to ~3800 bytes should fit
      // Note: The actual limit is lower due to memo payload overhead
      // Memo payload includes: protocol(8) + version(2) + type(4) + hashDropId(7) + 
      // contentHash(64) + contentType(10) + contentSize(4) + base64Content
      // Base64 encoding increases size by ~33%, so 3800 bytes of content becomes ~5067 bytes
      // Plus overhead of ~100 bytes = ~5167 bytes, which exceeds 4096
      // So we need smaller content for 4096-byte limit
      const smallerContent = 'x'.repeat(2800);
      expect(canFitInMemo(smallerContent, 4096)).toBe(true);
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
    it('should calculate max content size for legacy transactions', () => {
      const maxSize = getMaxContentSize(1232);
      expect(maxSize).toBeGreaterThan(1000);
      expect(maxSize).toBeLessThan(1232);
    });

    it('should calculate max content size for v1 transactions', () => {
      const maxSize = getMaxContentSize(4096);
      expect(maxSize).toBeGreaterThan(3000);
      expect(maxSize).toBeLessThan(4096);
    });
  });

  describe('calculateTransactionSize', () => {
    it('should calculate transaction size correctly', () => {
      const content = 'Hello, HashDrop!';
      const result = calculateTransactionSize(content, 1232);
      
      expect(result.contentBytes).toBe(content.length);
      expect(result.transactionBytes).toBeGreaterThan(0);
      expect(result.maxTransactionBytes).toBe(1232);
      expect(result.availableBytes).toBeGreaterThan(0);
    });

    it('should show negative available bytes for content that is too large', () => {
      const largeContent = 'x'.repeat(1500);
      const result = calculateTransactionSize(largeContent, 1232);
      
      expect(result.availableBytes).toBeLessThan(0);
    });
  });
});