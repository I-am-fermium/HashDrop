/**
 * Tests for the unified V3 PROOF payload format.
 *
 * One memo shape is used for every content kind:
 *   HASHDROP|v3|PROOF|hashDropId|sha256|contentSize|contentType|filename
 * There is no separate "text proof" vs "media proof" serialization.
 */

import {
  encodeProofPayload,
  decodeProofPayload,
  isValidProofPayload,
  decodeHashDropPayload,
  encodePublicPayload,
  encodePrivatePayload,
} from './memo';

const HASH = 'a'.repeat(64);

describe('Unified V3 PROOF payload', () => {
  describe('encodeProofPayload', () => {
    it('encodes the unified 8-field format for text and media alike', () => {
      expect(encodeProofPayload('hd_abc12345', HASH, 1234, 'text/plain', '')).toBe(
        `HASHDROP|v3|PROOF|hd_abc12345|${HASH}|1234|text/plain|`
      );
      expect(encodeProofPayload('hd_abc12345', HASH, 1234, 'image/png', 'photo.png')).toBe(
        `HASHDROP|v3|PROOF|hd_abc12345|${HASH}|1234|image/png|photo.png`
      );
      expect(encodeProofPayload('hd_abc12345', HASH, 1234, 'audio/webm', 'voice.webm')).toBe(
        `HASHDROP|v3|PROOF|hd_abc12345|${HASH}|1234|audio/webm|voice.webm`
      );
    });

    it('never includes the original bytes', () => {
      const memo = encodeProofPayload('hd_abc', HASH, 10, 'video/mp4', 'clip.mp4');
      expect(memo).not.toContain('fake-binary-media-content');
    });
  });

  describe('decodeProofPayload', () => {
    it('decodes the unified proof and exposes content type + filename', () => {
      const decoded = decodeProofPayload(
        encodeProofPayload('hd_abc12345', HASH, 1234, 'audio/webm', 'voice.webm')
      );
      expect(decoded).not.toBeNull();
      expect(decoded?.protocol).toBe('HASHDROP');
      expect(decoded?.version).toBe('v3');
      expect(decoded?.mode).toBe('PROOF');
      expect(decoded?.hashDropId).toBe('hd_abc12345');
      expect(decoded?.contentHash).toBe(HASH);
      expect(decoded?.contentSize).toBe(1234);
      expect(decoded?.contentType).toBe('audio/webm');
      expect(decoded?.filename).toBe('voice.webm');
    });

    it('decodes text proofs with contentType text/plain and filename ""', () => {
      const decoded = decodeProofPayload(
        encodeProofPayload('hd_abc', HASH, 99, 'text/plain', '')
      );
      expect(decoded?.contentType).toBe('text/plain');
      expect(decoded?.filename).toBe('');
    });

    it('rejects malformed and legacy payloads', () => {
      // Empty content type (7 parts from trailing separator) — invalid.
      expect(decodeProofPayload(`HASHDROP|v3|PROOF|hd_x|${HASH}|10|`)).toBeNull();
      // Legacy 6-field form is not part of the unified format.
      expect(decodeProofPayload(`HASHDROP|v3|PROOF|hd_x|${HASH}|10`)).toBeNull();
      // Wrong version
      expect(decodeProofPayload(`HASHDROP|v4|PROOF|hd_x|${HASH}|10|image/png|a.png`)).toBeNull();
      // Wrong mode
      expect(decodeProofPayload(`HASHDROP|v3|OTHER|hd_x|${HASH}|10|image/png|a.png`)).toBeNull();
      // Invalid hash
      expect(decodeProofPayload(`HASHDROP|v3|PROOF|hd_x|nothex|10|image/png|a.png`)).toBeNull();
      // Invalid size
      expect(decodeProofPayload(`HASHDROP|v3|PROOF|hd_x|${HASH}|-5|image/png|a.png`)).toBeNull();
    });
  });
describe('isValidProofPayload', () => {
    it('accepts only the 8-field unified proof form', () => {
      expect(isValidProofPayload(encodeProofPayload('hd_x', HASH, 1, 'text/plain', ''))).toBe(true);
      expect(
        isValidProofPayload(encodeProofPayload('hd_x', HASH, 1, 'video/webm', 'v.webm'))
      ).toBe(true);
      expect(isValidProofPayload(`HASHDROP|v3|PROOF|hd_x|${HASH}|1|video/webm`)).toBe(false); // 7 fields
      expect(isValidProofPayload(`HASHDROP|v3|PROOF|hd_x|${HASH}|1`)).toBe(false); // 6 fields
    });
  });

  describe('unified decoder dispatch', () => {
    it('dispatches unified PROOF payloads through decodeHashDropPayload', () => {
      const decoded = decodeHashDropPayload(
        encodeProofPayload('hd_abc', HASH, 42, 'image/jpeg', 'shot.jpg')
      );
      expect(decoded).not.toBeNull();
      expect(decoded?.mode).toBe('PROOF');
    });
  });

  describe('PUBLIC / PRIVATE formats remain unchanged', () => {
    it('public payload encoding is byte-identical', () => {
      expect(encodePublicPayload('hd_x', HASH, 'text/plain', 5, 'SGVsbG8=')).toBe(
        `HASHDROP|v3|PUBLIC|hd_x|${HASH}|text/plain|5|SGVsbG8=`
      );
    });

    it('private payload encoding is byte-identical (11 fields)', () => {
      const memo = encodePrivatePayload('hd_x', HASH, 5, 'text/plain', 'aabbccddeeff0011', 'ivbase', 'keybase');
      expect(memo).toBe(
        `HASHDROP|v3|PRIVATE|hd_x|${HASH}|5|text/plain|HD-P2|aabbccddeeff0011|ivbase|keybase`
      );
      expect(memo.split('|').length).toBe(11);
    });
  });
});