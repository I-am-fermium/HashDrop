/**
 * Tests for HashDrop Media Content Module
 *
 * Covers MIME classification, magic-byte signature detection, filename
 * sanitization, exact-byte hashing, size limits, and tamper sensitivity.
 */

import {
  classifyMimeType,
  isSupportedMime,
  isMediaMime,
  sanitizeFilename,
  detectMimeFromMagicBytes,
  resolveTrustedMime,
  formatFileSize,
  processMediaBytes,
  MAX_MEDIA_FILE_BYTES,
} from './media';
import { calculateHash } from './content';

// Minimal magic-byte fixtures (header bytes only — sufficient for detection).
const PNG_BYTES = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG_BYTES = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP_BYTES = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const GIF_BYTES = () => new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const MP4_BYTES = () => new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const MOV_BYTES = () => new Uint8Array([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
const WEBM_BYTES = () => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
const OGG_BYTES = () => new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
const WAV_BYTES = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
const MP3_BYTES = () => new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00]);

describe('Media Content Module', () => {
  describe('classifyMimeType', () => {
    it('classifies supported types into content kinds', () => {
      expect(classifyMimeType('text/plain')).toBe('TEXT');
      expect(classifyMimeType('image/jpeg')).toBe('IMAGE');
      expect(classifyMimeType('image/png')).toBe('IMAGE');
      expect(classifyMimeType('image/webp')).toBe('IMAGE');
      expect(classifyMimeType('video/mp4')).toBe('VIDEO');
      expect(classifyMimeType('video/webm')).toBe('VIDEO');
      expect(classifyMimeType('video/quicktime')).toBe('VIDEO');
      expect(classifyMimeType('audio/webm')).toBe('AUDIO');
      expect(classifyMimeType('audio/ogg')).toBe('AUDIO');
      expect(classifyMimeType('audio/wav')).toBe('AUDIO');
      expect(classifyMimeType('audio/mpeg')).toBe('AUDIO');
      expect(classifyMimeType('audio/mp4')).toBe('AUDIO');
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(classifyMimeType('  IMAGE/PNG ')).toBe('IMAGE');
    });

    it('returns null for unsupported types', () => {
      expect(classifyMimeType('application/octet-stream')).toBeNull();
      expect(classifyMimeType('image/svg+xml')).toBeNull();
      expect(classifyMimeType('video/avi')).toBeNull();
      expect(classifyMimeType('application/pdf')).toBeNull();
      expect(classifyMimeType('')).toBeNull();
    });
  });

  describe('isSupportedMime / isMediaMime', () => {
    it('distinguishes supported MIMEs and media (non-text) MIMEs', () => {
      expect(isSupportedMime('video/webm')).toBe(true);
      expect(isSupportedMime('application/pdf')).toBe(false);
      expect(isMediaMime('video/webm')).toBe(true);
      expect(isMediaMime('audio/wav')).toBe(true);
      expect(isMediaMime('image/png')).toBe(true);
      expect(isMediaMime('text/plain')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('replaces the protocol field separator and control characters', () => {
      expect(sanitizeFilename('a|b')).toBe('a_b');
      expect(sanitizeFilename('a\nb')).toBe('a_b');
      expect(sanitizeFilename('hello.png')).toBe('hello.png');
    });

    it('trims, caps length, and falls back to "file"', () => {
      expect(sanitizeFilename('  spaced.png  ')).toBe('spaced.png');
      expect(sanitizeFilename('')).toBe('file');
      expect(sanitizeFilename('|')).toBe('_');
      const longName = 'x'.repeat(300);
      expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(120);
    });
  });
describe('detectMimeFromMagicBytes', () => {
    it('detects every supported binary signature', () => {
      expect(detectMimeFromMagicBytes(PNG_BYTES())).toBe('image/png');
      expect(detectMimeFromMagicBytes(JPEG_BYTES())).toBe('image/jpeg');
      expect(detectMimeFromMagicBytes(WEBP_BYTES())).toBe('image/webp');
      expect(detectMimeFromMagicBytes(GIF_BYTES())).toBe('image/gif');
      expect(detectMimeFromMagicBytes(MP4_BYTES())).toBe('video/mp4');
      expect(detectMimeFromMagicBytes(MOV_BYTES())).toBe('video/quicktime');
      expect(detectMimeFromMagicBytes(WEBM_BYTES())).toBe('video/webm');
      expect(detectMimeFromMagicBytes(OGG_BYTES())).toBe('audio/ogg');
      expect(detectMimeFromMagicBytes(WAV_BYTES())).toBe('audio/wav');
      expect(detectMimeFromMagicBytes(MP3_BYTES())).toBe('audio/mpeg');
    });

    it('returns null for text and unknown bytes', () => {
      expect(detectMimeFromMagicBytes(new TextEncoder().encode('just some text'))).toBeNull();
      expect(detectMimeFromMagicBytes(new Uint8Array([1, 2, 3]))).toBeNull();
    });
  });

  describe('resolveTrustedMime', () => {
    it('trusts the magic-byte signature when it agrees with the declared type', () => {
      expect(resolveTrustedMime(PNG_BYTES(), 'image/png')).toBe('image/png');
      expect(resolveTrustedMime(JPEG_BYTES(), 'image/jpeg')).toBe('image/jpeg');
    });

    it('accepts container-compatible subtypes (WebM video/audio, MP4 audio/video)', () => {
      expect(resolveTrustedMime(WEBM_BYTES(), 'video/webm')).toBe('video/webm');
      expect(resolveTrustedMime(WEBM_BYTES(), 'audio/webm')).toBe('audio/webm');
      expect(resolveTrustedMime(MP4_BYTES(), 'video/mp4')).toBe('video/mp4');
      expect(resolveTrustedMime(MP4_BYTES(), 'audio/mp4')).toBe('audio/mp4');
    });

    it('prefers the actual byte signature over the declared subtype', () => {
      // A real PNG declared as JPEG: the byte signature is authoritative, so
      // the trusted MIME is the detected image/png (same IMAGE kind).
      expect(resolveTrustedMime(PNG_BYTES(), 'image/jpeg')).toBe('image/png');
      expect(resolveTrustedMime(JPEG_BYTES(), 'image/png')).toBe('image/jpeg');
    });

    it('REJECTS a spoofed declaration whose bytes belong to a different KIND', () => {
      // PNG bytes declared as text, or WAV bytes declared as an image — the
      // declared kind and the detected kind disagree, so the file is rejected.
      expect(resolveTrustedMime(PNG_BYTES(), 'text/plain')).toBeNull();
      expect(resolveTrustedMime(WAV_BYTES(), 'image/png')).toBeNull();
      expect(resolveTrustedMime(MP4_BYTES(), 'image/png')).toBeNull();
    });

    it('rejects a declaration of unsupported types and non-text bytes without a signature', () => {
      expect(resolveTrustedMime(PNG_BYTES(), 'application/octet-stream')).toBeNull();
      expect(resolveTrustedMime(new Uint8Array([1, 2, 3, 4, 5]), 'video/mp4')).toBeNull();
      expect(resolveTrustedMime(new Uint8Array([1, 2, 3, 4, 5]), 'application/pdf')).toBeNull();
    });

    it('accepts explicit text types without a magic signature', () => {
      const textBytes = new TextEncoder().encode('hello world');
      expect(resolveTrustedMime(textBytes, 'text/plain')).toBe('text/plain');
      expect(resolveTrustedMime(textBytes, 'text/markdown')).toBe('text/markdown');
    });
  });
describe('processMediaBytes', () => {
    it('hashes the EXACT original bytes and produces canonical metadata', async () => {
      const bytes = PNG_BYTES();
      const meta = await processMediaBytes(bytes, 'photo.png', 'image/png', 'Wallet123');
      const expectedHash = await calculateHash(bytes);
      expect(meta.hash).toBe(expectedHash);
      expect(meta.hash).toHaveLength(64);
      expect(meta.mimeType).toBe('image/png');
      expect(meta.contentKind).toBe('IMAGE');
      expect(meta.size).toBe(bytes.length);
      expect(meta.filename).toBe('photo.png');
      expect(meta.hashDropId).toContain('hd_');
    });

    it('determines the kind from the detected signature, not the declared type', async () => {
      const meta = await processMediaBytes(JPEG_BYTES(), 'wrong-ext.webp', 'image/webp', 'Wallet');
      // Signature is authoritative: JPEG body wins over the declared type/filename.
      expect(meta.mimeType).toBe('image/jpeg');
      expect(meta.contentKind).toBe('IMAGE');
    });

    it('rejects an empty file', async () => {
      await expect(processMediaBytes(new Uint8Array(0), 'e.png', 'image/png', 'W')).rejects.toThrow('empty');
    });

    it('rejects files exceeding the configurable size cap', async () => {
      // Allocate exactly one byte over the cap — 100 MB is the default limit.
      const oversized = new Uint8Array(MAX_MEDIA_FILE_BYTES + 1);
      await expect(processMediaBytes(oversized, 'big.mp4', 'video/mp4', 'W')).rejects.toThrow(
        'maximum upload limit'
      );
    });

    it('rejects MIME/bytes mismatches with a safe message', async () => {
      // Cross-kind mismatch: PNG bytes declared as video — must be rejected.
      await expect(processMediaBytes(PNG_BYTES(), 'fake.mp4', 'video/mp4', 'W')).rejects.toThrow(
        'Unsupported or unrecognized file type'
      );
      // Non-signature binary bytes declared as a supported image — rejected.
      await expect(processMediaBytes(new Uint8Array([1, 2, 3, 4, 5]), 'x.png', 'image/png', 'W')).rejects.toThrow();
    });
  });

  describe('tamper sensitivity (media bytes)', () => {
    it('a single modified byte produces a different SHA-256', async () => {
      const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
      const modified = original.slice();
      modified[modified.length - 1] = 0x03;

      const hashA = await processMediaBytes(original, 'a.png', 'image/png', 'W');
      const hashB = await processMediaBytes(modified, 'b.png', 'image/png', 'W');
      expect(hashA.hash).not.toBe(hashB.hash);
    });
  });

  describe('formatFileSize', () => {
    it('formats sizes in human-readable units', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });
  });
});