/**
 * Regression tests: WebCrypto calls must honor Uint8Array views (byteOffset /
 * byteLength) instead of falling back to the whole backing `.buffer`.
 *
 * These tests would FAIL under the old `x.buffer as ArrayBuffer` behavior:
 *   - a subarray-backed plaintext would encrypt the entire backing buffer
 *   - a subarray-backed key would import the parent buffer (wrong size → throw)
 *   - a subarray-backed IV/AAD would produce a different ciphertext than the
 *     equivalent exact byte copy
 *   - HKDF view inputs would derive different key material than their copies
 */

import { generateAesKey, generateAesIv, aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';
import { hkdfSha256 } from './hkdf';

describe('Crypto byte-view (subarray) safety', () => {
  it('AES-GCM honors a plaintext with non-zero byteOffset and smaller byteLength', async () => {
    const key = generateAesKey();
    const iv = generateAesIv();
    const aad = new TextEncoder().encode('aad');

    // Backing buffer is larger than the logical plaintext.
    const backing = new Uint8Array(64).fill(0xab);
    const secret = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    backing.set(secret, 10);
    const view = backing.subarray(10, 18); // byteOffset 10, byteLength 8

    const ciphertext = await aesGcmEncrypt(view, key, iv, aad);
    // The ciphertext must correspond to the 8 view bytes, not the 64-byte backing.
    expect(ciphertext.length).toBe(8 + 16);

    const decrypted = await aesGcmDecrypt(ciphertext, key, iv, aad);
    expect(Array.from(decrypted)).toEqual(Array.from(secret));
  });

  it('AES-GCM honors a key given as a 32-byte subarray of a larger buffer', async () => {
    const backing = new Uint8Array(40).fill(0x11);
    const keyBytes = generateAesKey();
    backing.set(keyBytes, 4);
    const keyView = backing.subarray(4, 36); // 32 bytes, byteOffset 4

    const iv = generateAesIv();
    const plaintext = new TextEncoder().encode('view key');

    const ciphertext = await aesGcmEncrypt(plaintext, keyView, iv);
    const decrypted = await aesGcmDecrypt(ciphertext, keyView, iv);
    expect(new TextDecoder().decode(decrypted)).toBe('view key');
  });

  it('AES-GCM IV view produces the same ciphertext as its exact byte copy', async () => {
    const key = generateAesKey();
    const plaintext = new TextEncoder().encode('deterministic');

    const ivSource = generateAesIv();
    const ivBacking = new Uint8Array(24).fill(0);
    ivBacking.set(ivSource, 6);
    const ivView = ivBacking.subarray(6, 18); // non-zero byteOffset
    const ivExact = new Uint8Array(ivSource); // byte-identical copy, offset 0

    // AES-GCM is deterministic for a fixed (key, IV, AAD, plaintext).
    const ctView = await aesGcmEncrypt(plaintext, key, ivView);
    const ctExact = await aesGcmEncrypt(plaintext, key, ivExact);
    expect(Buffer.from(ctView).equals(Buffer.from(ctExact))).toBe(true);
  });

  it('AES-GCM AAD view produces the same ciphertext as its exact byte copy and round-trips', async () => {
    const key = generateAesKey();
    const iv = generateAesIv();
    const plaintext = new TextEncoder().encode('aad view');

    const aadBytes = new TextEncoder().encode('domain-separated-aad');
    const aadBacking = new Uint8Array(30).fill(0);
    aadBacking.set(aadBytes, 2);
    const aadView = aadBacking.subarray(2, 2 + aadBytes.length);
    const aadExact = new Uint8Array(aadBytes);

    const ctView = await aesGcmEncrypt(plaintext, key, iv, aadView);
    const ctExact = await aesGcmEncrypt(plaintext, key, iv, aadExact);
    expect(Buffer.from(ctView).equals(Buffer.from(ctExact))).toBe(true);

    const decrypted = await aesGcmDecrypt(ctView, key, iv, aadView);
    expect(new TextDecoder().decode(decrypted)).toBe('aad view');
  });

  it('HKDF-SHA-256 honors IKM/salt/info subarray views exactly', async () => {
    const makeBytes = (len: number, fill: (i: number) => number) => {
      const arr = new Uint8Array(len);
      for (let i = 0; i < len; i++) arr[i] = fill(i) & 0xff;
      return arr;
    };

    const ikm = makeBytes(32, (i) => i * 3);
    const salt = new TextEncoder().encode('audit-salt');
    const info = new TextEncoder().encode('audit-info');

    const ikmBacking = new Uint8Array(40);
    ikmBacking.set(ikm, 8);
    const ikmView = ikmBacking.subarray(8, 40);

    const saltBacking = new Uint8Array(20);
    saltBacking.set(salt, 4);
    const saltView = saltBacking.subarray(4, 4 + salt.length);

    const infoBacking = new Uint8Array(24);
    infoBacking.set(info, 2);
    const infoView = infoBacking.subarray(2, 2 + info.length);

    const outView = await hkdfSha256(ikmView, saltView, infoView, 32);
    const outExact = await hkdfSha256(
      new Uint8Array(ikm),
      new Uint8Array(salt),
      new Uint8Array(info),
      32
    );
    expect(Buffer.from(outView).equals(Buffer.from(outExact))).toBe(true);
    expect(outView.length).toBe(32);
  });
});