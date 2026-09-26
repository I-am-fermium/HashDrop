import {
  adaptPublicVerifiedResult,
  adaptProofVerifiedResult,
  adaptPrivateVerifiedResult,
  buildVerificationUrl,
} from './adapter';
import {
  PublicVerificationResult,
  ProofVerificationResult,
  PrivateVerificationResult,
} from '../verification';

describe('Certificate Data Adapter (adapter.ts)', () => {
  const options = {
    networkDisplay: 'Devnet',
    verifiedAt: new Date('2026-09-26T12:00:00Z'),
    origin: 'https://hashdrop.io',
  };

  it('adapts a verified PUBLIC result into safe certificate data', () => {
    const pubResult: PublicVerificationResult = {
      verified: true,
      content: 'Hello World',
      hash: 'a'.repeat(64),
      hashDropId: 'hd_12345678_pub_1',
      contentHash: 'a'.repeat(64),
      contentType: 'text/plain',
      contentSize: 11,
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      signer: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      error: null,
      version: 'v3',
      mode: 'PUBLIC',
      transactionVersion: 'v0',
      blockTime: 1789000000,
      slot: 494119827,
    };

    const cert = adaptPublicVerifiedResult(pubResult, options);
    expect(cert).not.toBeNull();
    expect(cert?.verified).toBe(true);
    expect(cert?.mode).toBe('PUBLIC');
    expect(cert?.certificateId).toBe('hd_12345678_pub_1');
    expect(cert?.sha256).toBe('a'.repeat(64));
    expect(cert?.transactionId).toBe(pubResult.signature);
    expect(cert?.slot).toBe(494119827);
    expect(cert?.onChainRecordTime).toBe(new Date(1789000000 * 1000).toUTCString());
    expect(cert?.verifiedAt).toBe(new Date('2026-09-26T12:00:00Z').toUTCString());
    expect(cert?.verificationUrl).toContain('viewer?signature=');
    expect(cert?.explanations.length).toBeGreaterThan(0);
  });

  it('preserves null for onChainRecordTime if blockTime is missing', () => {
    const pubResult: PublicVerificationResult = {
      verified: true,
      content: 'Hello World',
      hash: 'a'.repeat(64),
      hashDropId: 'hd_12345678_pub_1',
      contentHash: 'a'.repeat(64),
      contentType: 'text/plain',
      contentSize: 11,
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      signer: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      error: null,
      version: 'v3',
      mode: 'PUBLIC',
      blockTime: null,
    };

    const cert = adaptPublicVerifiedResult(pubResult, options);
    expect(cert?.onChainRecordTime).toBeNull();
  });

  it('returns null if PUBLIC result verified is false', () => {
    const unverified: PublicVerificationResult = {
      verified: false,
      content: '',
      hash: '',
      hashDropId: '',
      contentHash: '',
      contentType: '',
      contentSize: 0,
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      error: 'Failure',
    };

    expect(adaptPublicVerifiedResult(unverified)).toBeNull();
  });

  it('adapts a verified PROOF result into safe certificate data', () => {
    const proofResult: ProofVerificationResult = {
      verified: true,
      hashDropId: 'hd_proof_99',
      contentHash: 'b'.repeat(64),
      contentSize: 2048,
      calculatedHash: 'b'.repeat(64),
      calculatedSize: 2048,
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      signer: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      error: null,
      version: 'v3',
      mode: 'PROOF',
      mimeType: 'image/png',
      filename: 'photo.png',
      transactionVersion: 'v0',
    };

    const cert = adaptProofVerifiedResult(proofResult, options);
    expect(cert).not.toBeNull();
    expect(cert?.verified).toBe(true);
    expect(cert?.mode).toBe('PROOF');
    expect(cert?.filename).toBe('photo.png');
    expect(cert?.mimeType).toBe('image/png');
    expect(cert?.originalSize).toBe(2048);
  });

  it('returns null if PROOF result verified is false', () => {
    const unverified: ProofVerificationResult = {
      verified: false,
      hashDropId: 'hd_proof_99',
      contentHash: 'b'.repeat(64),
      contentSize: 2048,
      calculatedHash: 'c'.repeat(64),
      calculatedSize: 2048,
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      error: 'Mismatch',
      version: 'v3',
      mode: 'PROOF',
    };

    expect(adaptProofVerifiedResult(unverified)).toBeNull();
  });

  it('adapts a verified PRIVATE result without exposing plaintext or private keys', () => {
    const privResult: PrivateVerificationResult = {
      verified: true,
      hashDropId: 'hd_priv_42',
      contentHash: 'c'.repeat(64),
      contentSize: 500,
      calculatedHash: 'c'.repeat(64),
      calculatedSize: 500,
      contentType: 'text/plain',
      plaintext: 'SUPER_SECRET_PLAINTEXT_NEVER_LEAK_TO_CERT',
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      signer: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      error: null,
      version: 'v3',
      mode: 'PRIVATE',
      transactionVersion: 'v0',
    };

    const cert = adaptPrivateVerifiedResult(privResult, {
      ...options,
      keyFingerprint: 'aabbccddeeff0011',
    });

    expect(cert).not.toBeNull();
    expect(cert?.verified).toBe(true);
    expect(cert?.mode).toBe('PRIVATE');
    expect(cert?.keyFingerprint).toBe('aabbccddeeff0011');
    expect(cert?.cryptoVersion).toBe('HD-P2');

    // Security check: ensure plaintext does NOT appear anywhere in the certificate object
    const serialized = JSON.stringify(cert);
    expect(serialized).not.toContain('SUPER_SECRET_PLAINTEXT_NEVER_LEAK_TO_CERT');
  });

  it('returns null if PRIVATE result verified is false', () => {
    const unverified: PrivateVerificationResult = {
      verified: false,
      hashDropId: 'hd_priv_42',
      contentHash: 'c'.repeat(64),
      contentSize: 500,
      calculatedHash: '',
      calculatedSize: 0,
      contentType: 'text/plain',
      plaintext: null,
      signature: '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd',
      error: 'Decryption failed',
      version: 'v3',
      mode: 'PRIVATE',
    };

    expect(adaptPrivateVerifiedResult(unverified)).toBeNull();
  });
});
