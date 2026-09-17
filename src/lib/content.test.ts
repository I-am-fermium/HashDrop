/**
 * Tests for HashDrop Content Engine
 */

import {
  stringToBytes,
  calculateHash,
  detectContentType,
  generateHashDropId,
  processContent,
} from './content';

describe('Content Engine', () => {
  describe('stringToBytes', () => {
    it('should convert string to UTF-8 bytes', () => {
      const input = 'Hello, HashDrop!';
      const bytes = stringToBytes(input);
      expect(bytes.length).toBe(16);
    });

    it('should handle empty string', () => {
      const bytes = stringToBytes('');
      expect(bytes.length).toBe(0);
    });

    it('should handle unicode characters', () => {
      const input = '你好';
      const bytes = stringToBytes(input);
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe('calculateHash', () => {
    it('should calculate SHA-256 hash', async () => {
      const content = 'test content';
      const bytes = stringToBytes(content);
      const hash = await calculateHash(bytes);
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes', async () => {
      const content = 'consistent content';
      const bytes = stringToBytes(content);
      const hash1 = await calculateHash(bytes);
      const hash2 = await calculateHash(bytes);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', async () => {
      const hash1 = await calculateHash(stringToBytes('content 1'));
      const hash2 = await calculateHash(stringToBytes('content 2'));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('detectContentType', () => {
    it('should detect JavaScript', () => {
      expect(detectContentType('function test() {}')).toBe('text/javascript');
      expect(detectContentType('const x = 1')).toBe('text/typescript');
      expect(detectContentType('export default {}')).toBe('text/typescript');
      expect(detectContentType('import { x } from "y"')).toBe('text/typescript');
    });

    it('should detect HTML', () => {
      expect(detectContentType('<html><body></body></html>')).toBe('text/html');
    });

    it('should detect JSON', () => {
      expect(detectContentType('{"key": "value"}')).toBe('application/json');
    });

    it('should detect Markdown', () => {
      expect(detectContentType('# Heading')).toBe('text/markdown');
    });

    it('should detect CSS', () => {
      expect(detectContentType('.class { color: red; }')).toBe('text/css');
    });

    it('should default to plain text', () => {
      expect(detectContentType('random text content')).toBe('text/plain');
    });
  });

  describe('generateHashDropId', () => {
    it('should generate deterministic ID', () => {
      const hash = 'a'.repeat(64);
      const creator = 'SolanaWalletAddress';
      const size = 100;

      const id1 = generateHashDropId(hash, creator, size);
      const id2 = generateHashDropId(hash, creator, size);

      expect(id1).toBe(id2);
      expect(id1).toContain('hd_');
    });

    it('should include hash prefix', () => {
      const hash = 'abcdef1234567890' + '0'.repeat(48);
      const creator = 'CreatorAddress';
      const size = 100;

      const id = generateHashDropId(hash, creator, size);
      expect(id).toContain(hash.slice(0, 8));
    });
  });

  describe('processContent', () => {
    it('should process content completely', async () => {
      const content = 'export const test = "Hello World";';
      const creator = 'TestCreator123';

      const result = await processContent(content, creator);

      // Check that bytes is a Uint8Array by checking its constructor name
      expect(result.bytes.constructor.name).toBe('Uint8Array');
      expect(result.bytes.length).toBe(content.length);
      expect(result.hash).toHaveLength(64);
      expect(result.size).toBe(content.length);
      expect(result.mimeType).toBe('text/typescript');
      expect(result.contentKind).toBe('TEXT');
      expect(result.filename).toBe('');
      expect(result.hashDropId).toContain('hd_');
    });

    it('should handle empty content', async () => {
      const result = await processContent('', 'Creator');
      expect(result.size).toBe(0);
    });
  });
});