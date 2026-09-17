/**
 * Tests for strict canonical Base64 handling in the encoding utilities.
 *
 * Protocol property proven here: HashDrop Base64 fields have exactly ONE
 * canonical wire representation — RFC 4648 §4 standard alphabet, zero-filled
 * padding, the exact form btoa() emits. Alternative textual encodings of the
 * same bytes must NOT be accepted, otherwise the same protocol field would be
 * silently "normalized" at decode time — differently per runtime (forgiving
 * browser atob vs lenient Node Buffer.from(str, 'base64')).
 */

import { utf8ToBase64, base64ToUtf8, bytesToBase64, base64ToBytes } from './encoding';

describe('strict canonical Base64 (encoding.ts)', () => {
  it('round-trips the canonical representation HashDrop emits (utf8ToBase64)', () => {
    for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'Hello 🌍 नमस्ते こんにちは']) {
      const b64 = utf8ToBase64(text);
      expect(base64ToUtf8(b64)).toBe(text);
    }
  });

  it('round-trips arbitrary binary bytes byte-exactly (bytesToBase64)', () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    const decoded = base64ToBytes(bytesToBase64(bytes));
    expect(Buffer.from(decoded).equals(Buffer.from(bytes))).toBe(true);
  });

  it('accepts one-, two- and three-byte data with canonical padding', () => {
    for (const data of [[0x41], [0x41, 0x42], [0x41, 0x42, 0x43]] as const) {
      const decoded = base64ToBytes(bytesToBase64(new Uint8Array(data)));
      expect(Buffer.from(decoded).equals(Buffer.from(data))).toBe(true);
    }
  });

  it('permits empty input (zero bytes) — protocol fields reject emptiness themselves', () => {
    expect(base64ToBytes('').length).toBe(0);
  });

  it('rejects invalid characters (standard alphabet only; no base64url)', () => {
    for (const bad of ['SGVs!bG8=', 'SGVsbG8-', 'SGVsbG8_', 'not base64!', 'SGVsbG8=,']) {
      expect(() => base64ToBytes(bad)).toThrow('Invalid Base64');
      expect(() => base64ToUtf8(bad)).toThrow('Invalid Base64');
    }
  });

  it('rejects embedded or surrounding whitespace', () => {
    for (const bad of ['SGVs bG8=', ' SGVsbG8=', 'SGVsbG8= ', 'SGVsbG8=\n', 'SGVsbG8=\t']) {
      expect(() => base64ToBytes(bad)).toThrow('Invalid Base64');
    }
  });

  it('rejects missing, misplaced or excess padding', () => {
    expect(() => base64ToBytes('QQ')).toThrow('Invalid Base64');    // unpadded
    expect(() => base64ToBytes('QQ=')).toThrow('Invalid Base64');   // short
    expect(() => base64ToBytes('QQ===')).toThrow('Invalid Base64'); // excess
    expect(() => base64ToBytes('=QQ=')).toThrow('Invalid Base64');  // misplaced
    expect(() => base64ToBytes('Q=Q=')).toThrow('Invalid Base64');  // misplaced
    expect(() => base64ToBytes('A===')).toThrow('Invalid Base64');  // excess
    expect(() => base64ToBytes('QQ==')).not.toThrow();              // canonical
  });

  it('rejects non-canonical padding bits (alternative encodings of the same bytes)', () => {
    // 1 byte 0x41 → canonical 'QQ=='. Every alternative last character with
    // non-zero discarded bits decodes to the SAME byte and must be rejected.
    expect(base64ToBytes('QQ==')[0]).toBe(0x41);
    for (const bad of ['QR==', 'QT==', 'QU==', 'QV==', 'QW==', 'QX==']) {
      expect(() => base64ToBytes(bad)).toThrow('non-canonical padding');
    }
    // 2-byte quantum: the last data character's two discarded bits must be 0.
    expect(() => base64ToBytes('AB8=')).not.toThrow();
    expect(() => base64ToBytes('AB9=')).toThrow('non-canonical padding');
  });

  it('rejects impossible lengths (truncated input)', () => {
    const canonical = utf8ToBase64('foobar');
    for (let cut = 1; cut < canonical.length; cut++) {
      if (cut % 4 === 0) continue; // a 4-char-aligned unpadded prefix is itself canonical Base64
      expect(() => base64ToBytes(canonical.slice(0, cut))).toThrow('Invalid Base64');
    }
  });
});