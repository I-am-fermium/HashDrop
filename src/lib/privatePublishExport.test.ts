/**
 * Focused tests for the V3 PRIVATE publish → export → Viewer path.
 *
 * These tests simulate the EXACT publish sequence used by src/app/page.tsx
 * (confirmAndPublish, mode === 'private'):
 *
 *   ONE keypair  -> ONE encryption  -> artifact + key envelope
 *                                        │
 *              key envelope (iv+key) ────┤──> encodePrivatePayload (on-chain memo)
 *                                        │
 *              exportArtifact()     ─────┴──> what the user downloads (.hdp)
 *              exportSecretKey()    ───────> what the user downloads (.txt)
 *
 * They verify (per task requirements):
 *   A. private key export begins with  HASHDROP-KEY|v1|ML-KEM-768|
 *   B. artifact export begins with     HASHDROP-PRIVATE-BLOB|v1|
 *   C. artifact carries the SAME hashDropId / sha256 / contentSize /
 *      mimeType / cryptoVersion / keyFingerprint as the published payload
 *   D. exported private key corresponds to the published key fingerprint
 *   E. the artifact contains NO private key material
 *   F. the artifact contains NO plaintext
 *   G. downloaded artifact + exported key decrypt & VERIFY via the existing
 *      verifyPrivateDrop implementation (the Viewer's code path)
 *   H. a wrong private key still fails verification
 *   I. a modified artifact still fails verification
 *   J. PUBLIC and PROOF payload encoding remain unaffected
 */

import { processContent, stringToBytes, calculateHash } from './content';
import {
  encryptPrivateContent,
  generateRecipientKeypair,
} from './crypto/privateDrop';
import {
  calculateKeyFingerprint,
  exportSecretKey,
  exportPublicKey,
  importSecretKey,
  importPublicKey,
  validateKeyPair,
} from './crypto/keyManager';
import {
  exportArtifact,
  importArtifact,
} from './crypto/encryptedArtifact';
import {
  encodePrivatePayload,
  encodePublicPayload,
  encodeProofPayload,
  decodePublicPayload,
  decodeProofPayload,
  HASHDROP_PRIVATE_CRYPTO_VERSION,
  MEMO_PROGRAM_ID,
} from './memo';
import { verifyPrivateDrop, verifyBySignature, PrivateVerificationResult } from './verification';
import { bytesToBase64, base64ToBytes, utf8ToBase64 } from './encoding';
import type { Connection } from '@solana/web3.js';
import {
  buildPrivateArtifactFilename,
  buildPrivateKeyFilename,
  buildPublicKeyFilename,
} from './download';

// ---------------------------------------------------------------------------
// Fake Solana connection for verifyPrivateDrop (same pattern as /viewer tests)
// ---------------------------------------------------------------------------

const mockGetTransaction = jest.fn();
const fakeConnection = {
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
} as unknown as Connection;

// 88 valid base58 characters
const SIGNATURE =
  '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd';
const PUBLISHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const PLAINTEXT = 'PRIVATE-DROP-SECRET-CONTENT';

function fakeTxWithMemo(memo: string) {
  return {
    version: undefined,
    slot: 12345,
    blockTime: 1700000000,
    meta: { err: null },
    transaction: {
      message: {
        accountKeys: [PUBLISHER, MEMO_PROGRAM_ID],
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            accounts: [],
            data: memo, // plain string branch of decodeInstructionData
          },
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Publish-side simulation (mirrors src/app/page.tsx, mode === 'private')
// ---------------------------------------------------------------------------

async function simulatePrivatePublish() {
  // 1. Content processing (same as page.tsx textMeta)
  const meta = await processContent(PLAINTEXT, PUBLISHER);

  // 2. ONE ML-KEM-768 keypair for this drop (same as page.tsx)
  const keypair = await generateRecipientKeypair();

  // 3. Key fingerprint of that keypair's public key (same as page.tsx)
  const keyFingerprint = await calculateKeyFingerprint(keypair.publicKey);

  // 4. ONE encryption of the content (same as page.tsx)
  const encryptionResult = await encryptPrivateContent(
    stringToBytes(PLAINTEXT),
    meta.hash,
    meta.mimeType,
    keypair.publicKey,
    keyFingerprint,
    meta.hashDropId
  );

  // 5. The on-chain memo — built from EXACTLY the arguments page.tsx passes
  //    to buildPrivateTransaction (commitment + encrypted key envelope only).
  const onChainMemo = encodePrivatePayload(
    meta.hashDropId,
    encryptionResult.plaintextHash,
    encryptionResult.plaintextSize,
    encryptionResult.contentType,
    keyFingerprint,
    bytesToBase64(encryptionResult.encryptedKeyEnvelope.iv),
    bytesToBase64(encryptionResult.encryptedKeyEnvelope.encryptedKey)
  );

  // 6. What the UI exports after a successful transaction — canonical
  //    envelopes generated from the SAME artifacts (no reconstruction).
  const artifactEnvelope = exportArtifact(encryptionResult.encryptedArtifact);
  const privateKeyEnvelope = exportSecretKey(keypair.secretKey);
  const publicKeyEnvelope = exportPublicKey(keypair.publicKey);

  return {
    meta,
    keypair,
    keyFingerprint,
    encryptionResult,
    onChainMemo,
    artifactEnvelope,
    privateKeyEnvelope,
    publicKeyEnvelope,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PRIVATE publish → export → Viewer compatibility', () => {
  beforeEach(() => {
    mockGetTransaction.mockReset();
  });

  it('A/B: exports canonical envelopes with the exact required prefixes + filenames', async () => {
    const pub = await simulatePrivatePublish();

    // A. private key export prefix
    expect(pub.privateKeyEnvelope.startsWith('HASHDROP-KEY|v1|ML-KEM-768|')).toBe(true);
    // Public key export prefix (optional export)
    expect(pub.publicKeyEnvelope.startsWith('HASHDROP-PUBKEY|v1|ML-KEM-768|')).toBe(true);
    // B. artifact export prefix
    expect(pub.artifactEnvelope.startsWith('HASHDROP-PRIVATE-BLOB|v1|')).toBe(true);

    // Filenames used by the UI
    expect(buildPrivateArtifactFilename(pub.meta.hashDropId)).toBe(
      `hashdrop-private-${pub.meta.hashDropId}.hdp`
    );
    expect(buildPrivateKeyFilename(pub.keyFingerprint)).toBe(
      `hashdrop-mlkem-768-private-key-${pub.keyFingerprint}.txt`
    );
    expect(buildPublicKeyFilename(pub.keyFingerprint)).toBe(
      `hashdrop-mlkem-768-public-key-${pub.keyFingerprint}.txt`
    );
  });

  it('C: artifact fields exactly match the published PRIVATE transaction payload', async () => {
    const pub = await simulatePrivatePublish();

    const a = pub.artifactEnvelope.split('|');
    const m = pub.onChainMemo.split('|');
    // Canonical artifact envelope: 13 fields (type at index 5; trailing filename
    // '' for text). The PRIVATE memo stays 11 fields.
    expect(a.length).toBe(13);
    expect(m.length).toBe(11);
    expect(m[0]).toBe('HASHDROP');
    expect(m[2]).toBe('PRIVATE');

    // memo:    HASHDROP|v3|PRIVATE|id|sha256|size|mime|cryptoVer|fp|iv|key
    // artifact: HASHDROP-PRIVATE-BLOB|v1|id|sha256|size|type|mime|cryptoVer|fp|ct|iv|ciphertext|filename
    expect(a[2]).toBe(m[3]); // hashDropId
    expect(a[3]).toBe(m[4]); // SHA-256 commitment
    expect(a[4]).toBe(m[5]); // content size
    expect(a[5]).toBe('TEXT'); // object type (version ≠ type)
    expect(a[6]).toBe(m[6]); // MIME type
    expect(a[7]).toBe(m[7]); // crypto version
    expect(a[7]).toBe(HASHDROP_PRIVATE_CRYPTO_VERSION);
    expect(a[8]).toBe(m[8]); // key fingerprint
    expect(a[12]).toBe(''); // filename — '' for text drops

    // The artifact is the exact encryption output (no reconstruction)
    const artifact = importArtifact(pub.artifactEnvelope);
    expect(artifact.hashDropId).toBe(pub.encryptionResult.hashDropId);
    expect(artifact.contentHash).toBe(pub.encryptionResult.plaintextHash);
    expect(artifact.contentSize).toBe(pub.encryptionResult.plaintextSize);
    expect(artifact.contentType).toBe(pub.encryptionResult.contentType);
    expect(artifact.keyFingerprint).toBe(pub.encryptionResult.keyFingerprint);
    expect(
      Buffer.from(artifact.iv).equals(Buffer.from(pub.encryptionResult.encryptedArtifact.iv))
    ).toBe(true);
    expect(
      Buffer.from(artifact.ciphertext).equals(
        Buffer.from(pub.encryptionResult.encryptedArtifact.ciphertext)
      )
    ).toBe(true);
  });

  it('D: exported private key corresponds to the published key fingerprint', async () => {
    const pub = await simulatePrivatePublish();

    const secretKey = importSecretKey(pub.privateKeyEnvelope);
    const publicKey = importPublicKey(pub.publicKeyEnvelope);

    // The exported secret/public pair is valid
    expect(await validateKeyPair(secretKey, publicKey)).toBe(true);

    // The fingerprint of the exported public key == the fingerprint published
    // on-chain and embedded in the artifact
    expect(await calculateKeyFingerprint(publicKey)).toBe(pub.keyFingerprint);
  });

  it('E/F: artifact contains neither private key material nor plaintext', async () => {
    const pub = await simulatePrivatePublish();

    const secretBase64 = pub.privateKeyEnvelope.split('|')[3];

    // E. no private key material anywhere in the artifact
    expect(pub.artifactEnvelope).not.toContain(pub.privateKeyEnvelope);
    expect(pub.artifactEnvelope).not.toContain(secretBase64);

    // F. no plaintext anywhere in the artifact
    expect(pub.artifactEnvelope).not.toContain(PLAINTEXT);
    expect(pub.artifactEnvelope).not.toContain(bytesToBase64(stringToBytes(PLAINTEXT)));
  });

  it('G: downloaded artifact + exported key decrypt & VERIFY via the existing Viewer path', async () => {
    const pub = await simulatePrivatePublish();
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(pub.onChainMemo));

    // Exactly what the Viewer does: importArtifact + importSecretKey + verifyPrivateDrop
    const artifact = importArtifact(pub.artifactEnvelope);
    const secretKey = importSecretKey(pub.privateKeyEnvelope);

    const result: PrivateVerificationResult = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      secretKey,
      artifact,
      artifact.mlKemCiphertext,
      pub.meta.hashDropId
    );

    expect(result.verified).toBe(true);
    expect(result.error).toBeNull();
    expect(result.plaintext).toBe(PLAINTEXT);
    expect(result.contentHash).toBe(pub.meta.hash); // on-chain commitment
    expect(result.calculatedHash).toBe(pub.meta.hash); // SHA-256 of decrypted plaintext
  });

  it('H: a wrong private key still fails verification', async () => {
    const pub = await simulatePrivatePublish();
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(pub.onChainMemo));

    // A DIFFERENT keypair (never used during publish) — simulates a user
    // exporting/importing the wrong key file.
    const wrongKeypair = await generateRecipientKeypair();
    const wrongSecretKey = importSecretKey(exportSecretKey(wrongKeypair.secretKey));
    const artifact = importArtifact(pub.artifactEnvelope);

    const result = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      wrongSecretKey,
      artifact,
      artifact.mlKemCiphertext,
      pub.meta.hashDropId
    );

    expect(result.verified).toBe(false);
    expect(result.plaintext).toBeNull();
  });

  it('I: a modified artifact still fails verification', async () => {
    const pub = await simulatePrivatePublish();
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(pub.onChainMemo));

    // Flip one byte of the AES-GCM ciphertext inside the artifact envelope
    // (ciphertext is field index 11; filename is the trailing field).
    const parts = pub.artifactEnvelope.split('|');
    const ciphertext = base64ToBytes(parts[11]);
    ciphertext[0] ^= 0xff;
    const tamperedEnvelope = [...parts.slice(0, 11), bytesToBase64(ciphertext), parts[12]].join('|');

    const tamperedArtifact = importArtifact(tamperedEnvelope);
    const secretKey = importSecretKey(pub.privateKeyEnvelope);

    const result = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      secretKey,
      tamperedArtifact,
      tamperedArtifact.mlKemCiphertext,
      pub.meta.hashDropId
    );

    expect(result.verified).toBe(false);
    expect(result.plaintext).toBeNull();
  });

  it('K: a memo with a foreign cryptoVersion (HD-P1) fails closed before decryption', async () => {
    const pub = await simulatePrivatePublish();
    const parts = pub.onChainMemo.split('|');
    parts[7] = 'HD-P1'; // tamper ONLY the crypto version field
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(parts.join('|')));

    const artifact = importArtifact(pub.artifactEnvelope);
    const secretKey = importSecretKey(pub.privateKeyEnvelope);

    const result: PrivateVerificationResult = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      secretKey,
      artifact,
      artifact.mlKemCiphertext,
      pub.meta.hashDropId
    );

    // Parse failure → the memo is rejected before any ML-KEM/AES-GCM work:
    // no verified result and no plaintext can ever be produced.
    expect(result.verified).toBe(false);
    expect(result.plaintext).toBeNull();
    expect(result.plaintextBytes).toBeUndefined();
  });

  it('L: a non-canonical size memo ("0100") fails closed before decryption', async () => {
    const pub = await simulatePrivatePublish();
    const parts = pub.onChainMemo.split('|');
    parts[5] = `0${parts[5]}`; // 100 → 0100: same numeric value, non-canonical wire form
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(parts.join('|')));

    const artifact = importArtifact(pub.artifactEnvelope);
    const secretKey = importSecretKey(pub.privateKeyEnvelope);

    const result = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      secretKey,
      artifact,
      artifact.mlKemCiphertext,
      pub.meta.hashDropId
    );

    expect(result.verified).toBe(false);
    expect(result.plaintext).toBeNull();
    expect(result.plaintextBytes).toBeUndefined();
  });

  it('M: malformed key-envelope lengths fail closed before decryption (F-1)', async () => {
    const pub = await simulatePrivatePublish();
    const secretKey = importSecretKey(pub.privateKeyEnvelope);
    const artifact = importArtifact(pub.artifactEnvelope);

    // The key envelope is a fixed-size structure: IV = 12 bytes, wrapped key =
    // 32-byte AES-256 content key + 16-byte GCM tag = 48 bytes. Anything else
    // must be rejected at the validation boundary, before any crypto runs.
    const malformedCases: Array<[number, number]> = [
      [9, 11], // IV of 11 bytes
      [9, 13], // IV of 13 bytes
      [10, 47], // wrapped key of 47 bytes
      [10, 49], // wrapped key of 49 bytes
    ];
    for (const [fieldIndex, byteLength] of malformedCases) {
      const parts = pub.onChainMemo.split('|');
      parts[fieldIndex] = bytesToBase64(new Uint8Array(byteLength)); // valid Base64, wrong length
      mockGetTransaction.mockResolvedValue(fakeTxWithMemo(parts.join('|')));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        secretKey,
        artifact,
        artifact.mlKemCiphertext,
        pub.meta.hashDropId
      );

      expect(result.verified).toBe(false);
      expect(result.plaintext).toBeNull();
      expect(result.plaintextBytes).toBeUndefined();
      expect(result.error).toContain('Invalid private key envelope');
    }
  });

  it('N: a PUBLIC memo with a non-canonical hash is rejected at parse time (F-2)', async () => {
    const pub = await simulatePrivatePublish();
    // Uppercase hex is the same semantic value but a different protocol byte
    // string; the canonical lowercase form is the only accepted representation.
    const parts = pub.onChainMemo.split('|');
    parts[4] = parts[4].toUpperCase();
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(parts.join('|')));

    const result = await verifyBySignature(fakeConnection, SIGNATURE, pub.meta.hashDropId);

    expect(result.verified).toBe(false);
    expect(result.content).toBe('');
  });

  it('O: malformed/non-canonical Base64 in the key envelope fails closed before decryption (Gap A)', async () => {
    const pub = await simulatePrivatePublish();
    const secretKey = importSecretKey(pub.privateKeyEnvelope);
    const artifact = importArtifact(pub.artifactEnvelope);

    // Representative malformed/non-canonical Base64 entering through the REAL
    // on-chain memo fields (field 10 = envelope IV, field 9 = wrapped key).
    // Every case must be rejected by the strict canonical Base64 validator
    // BEFORE any key derivation or AES-GCM work; the failure must be the
    // structured verification failure, never a crash or a silent pass.
    const malformedCases: Array<[number, string]> = [
      [10, 'not base64!!'],    // invalid alphabet (IV field)
      [10, 'QQ'],              // missing padding / impossible length (IV field)
      [10, 'QT=='],            // non-canonical discarded bits (IV field)
      [9, 'QQ==='],            // excess padding (wrapped-key field)
      [9, 'QUJDRUZH_'],        // base64url alphabet (wrapped-key field)
    ];
    for (const [fieldIndex, badValue] of malformedCases) {
      const parts = pub.onChainMemo.split('|');
      parts[fieldIndex] = badValue;
      mockGetTransaction.mockResolvedValue(fakeTxWithMemo(parts.join('|')));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        secretKey,
        artifact,
        artifact.mlKemCiphertext,
        pub.meta.hashDropId
      );

      expect(result.verified).toBe(false);
      expect(result.plaintext).toBeNull();
      expect(result.plaintextBytes).toBeUndefined();
      expect(result.error).toContain('Invalid Base64');
    }
  });

  it('P: rejects a wrapped key substituted from an independent drop (Gap C)', async () => {
    // Two genuinely independent PRIVATE drops of the same content: identical
    // commitment metadata (same hash/size/MIME/ID), different ML-KEM keypairs
    // and therefore different fingerprints and wrapped-key envelopes.
    const dropA = await simulatePrivatePublish();
    const dropB = await simulatePrivatePublish();

    // Substitute ONLY drop B's wrapped-key envelope (fields 9/10) into drop A's
    // memo. Stage-5 artifact/memo equality still passes, and the F-1 length
    // checks still pass (drop B's envelope is structurally valid). The
    // rejection must come from the cryptographic binding: drop A's capsule
    // derives drop A's KEK, which cannot authenticate drop B's wrapped key
    // under drop A's AAD2 context.
    const parts = dropA.onChainMemo.split('|');
    const bParts = dropB.onChainMemo.split('|');
    parts[9] = bParts[9];
    parts[10] = bParts[10];
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(parts.join('|')));

    const artifactA = importArtifact(dropA.artifactEnvelope);
    const secretKeyA = importSecretKey(dropA.privateKeyEnvelope);

    const result = await verifyPrivateDrop(
      fakeConnection,
      SIGNATURE,
      secretKeyA,
      artifactA,
      artifactA.mlKemCiphertext,
      dropA.meta.hashDropId
    );

    expect(result.verified).toBe(false);
    expect(result.plaintext).toBeNull();
    expect(result.plaintextBytes).toBeUndefined();
    expect(result.error).toContain('Key unwrapping failed');
  });

const PUBLIC_CONTENT = 'PUBLIC-VERIFICATION-ORIGINAL';
const OTHER_CONTENT = 'TAMPERED-SUBSTITUTE-BODY';

  it('Q: accepts PUBLIC content whose SHA-256 matches the on-chain commitment (control for the integrity test)', async () => {
    // Control for test R: the same canonical PUBLIC memo with the CORRECT
    // content verifies — proving that the mismatch rejection in R comes from
    // the content-integrity comparison, not from parse rejection.
    const hash = await calculateHash(stringToBytes(PUBLIC_CONTENT));
    const memo = encodePublicPayload(
      'hd_publictest01',
      hash,
      'text/plain',
      stringToBytes(PUBLIC_CONTENT).length,
      utf8ToBase64(PUBLIC_CONTENT)
    );
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(memo));

    const result = await verifyBySignature(fakeConnection, SIGNATURE);

    expect(result.verified).toBe(true);
    expect(result.content).toBe(PUBLIC_CONTENT);
    expect(result.error).toBeNull();
  });

  it('R: rejects PUBLIC content whose canonical hash does not match (Gap B — integrity failure, not parse failure)', async () => {
    // The on-chain commitment is the canonical SHA-256 of DIFFERENT content.
    // The memo is fully canonical (valid lowercase 64-hex hash, canonical
    // size) and parses successfully — the rejection must therefore come from
    // the content-integrity comparison after SHA-256 recomputation, and the
    // mismatched content must never be exposed as verified.
    const otherHash = await calculateHash(stringToBytes(OTHER_CONTENT));
    const memo = encodePublicPayload(
      'hd_publictest01',
      otherHash,
      'text/plain',
      stringToBytes(PUBLIC_CONTENT).length,
      utf8ToBase64(PUBLIC_CONTENT)
    );
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(memo));

    const result = await verifyBySignature(fakeConnection, SIGNATURE);

    expect(result.verified).toBe(false);
    expect(result.content).toBe('');
    expect(result.hash).not.toBe(result.contentHash);
    expect(result.error).toContain('CONTENT VERIFICATION FAILED');
  });

  it('J: PUBLIC and PROOF payload encoding remain unaffected', () => {
    // PUBLIC round-trip still works with the canonical V3 format
    const publicMemo = encodePublicPayload('hd_pub', 'a'.repeat(64), 'text/plain', 5, 'SGVsbG8=');
    const decodedPublic = decodePublicPayload(publicMemo);
    expect(decodedPublic).not.toBeNull();
    expect(decodedPublic!.mode).toBe('PUBLIC');
    expect(decodedPublic!.content).toBe('SGVsbG8=');

    // PROOF round-trip still works with the canonical V3 format
    const proofMemo = encodeProofPayload('hd_proof', 'b'.repeat(64), 16, 'text/plain', '');
    const decodedProof = decodeProofPayload(proofMemo);
    expect(decodedProof).not.toBeNull();
    expect(decodedProof!.mode).toBe('PROOF');
    expect(decodedProof!.contentHash).toBe('b'.repeat(64));
    expect(decodedProof!.contentType).toBe('text/plain');
  });
});


