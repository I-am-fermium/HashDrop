/**
 * Cross-type lifecycle and tamper tests for HashDrop media support.
 *
 * Exercises the FULL lifecycle for PROOF and PRIVATE modes across
 * TEXT / IMAGE / VIDEO / AUDIO:
 *
 *   proof  : bytes -> SHA-256 -> encodeMemo -> transaction -> retrieve -> hash -> verify
 *   private: bytes -> SHA-256 -> AES-256-GCM encrypt -> artifact -> memo -> retrieve
 *            -> decrypt -> SHA-256 -> verify
 *
 * Uses the REAL Solana v0 RPC response shape (staticAccountKeys +
 * compiledInstructions) exactly like src/lib/verification.v0Shape.test.ts and
 * real WebCrypto primitives (SHA-256 / AES-256-GCM / ML-KEM-768).
 */

import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  verifyProofDrop,
  verifyProofDropBytes,
  verifyPrivateDrop,
  ProofVerificationResult,
  PrivateVerificationResult,
} from './verification';
import { processMediaBytes, isMediaMime } from './media';
import { calculateHash } from './content';
import { generateRecipientKeypair, encryptPrivateContent } from './crypto/privateDrop';
import { calculateKeyFingerprint } from './crypto/keyManager';
import { encodeProofPayload, encodePrivatePayload, MEMO_PROGRAM_ID } from './memo';
import { bytesToBase64 } from './encoding';
import { importArtifact, exportArtifact } from './crypto/encryptedArtifact';

const SIGNATURE =
  '4n8Uibg92YushsYrVzczCXuursWwkG3rbwBMKiZ7U9T7UTDQVseASVmbiFoj51KdZTrSiJitRZu4C6aRkvjNMcCn';
const PUBLISHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

const mockGetTransaction = jest.fn();
const fakeConnection = {
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
} as unknown as import('@solana/web3.js').Connection;

/** Real Devnet v0 getTransaction() shape: staticAccountKeys + compiledInstructions. */
function devnetV0Transaction(memoData: string) {
  return {
    version: 0,
    slot: 494119827,
    blockTime: 1789000000,
    transactionIndex: 0,
    meta: {
      computeUnitsConsumed: 12345,
      costUnits: 12345,
      err: null,
      fee: 5000,
      innerInstructions: [],
      loadedAddresses: { readonly: [], writable: [] },
      logMessages: [],
      postBalances: [499999995000, 1, 1],
      preBalances: [500000000000, 1, 1],
      preTokenBalances: [],
      postTokenBalances: [],
      rewards: [],
      status: { Ok: null },
    },
    transaction: {
      message: {
        header: {
          numRequiredSignatures: 1,
          numReadonlySignedAccounts: 0,
          numReadonlyUnsignedAccounts: 2,
        },
        staticAccountKeys: [
          new PublicKey(PUBLISHER),
          SystemProgram.programId,
          new PublicKey(MEMO_PROGRAM_ID),
        ],
        recentBlockhash: '11111111111111111111111111111111',
        compiledInstructions: [
          {
            programIdIndex: 1,
            accountKeyIndexes: [0, 0],
            data: Buffer.from([2, 0, 0, 0, 64, 66, 15, 0, 0, 0, 0, 0]),
          },
          {
            programIdIndex: 2,
            accountKeyIndexes: [],
            data: Buffer.from(memoData, 'utf8'),
          },
        ],
        addressTableLookups: [],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Media fixtures (minimal but signature-valid byte sequences)
// ---------------------------------------------------------------------------
const IMAGE_BYTES = () =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const VIDEO_BYTES = () =>
  new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 1, 2, 3, 4, 5]);
const AUDIO_BYTES = () =>
  new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 1, 2, 3, 4, 5, 6]);

interface ProofFixture {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  memo: string;
}

async function simulateProofMediaPublish(): Promise<ProofFixture> {
  const bytes = IMAGE_BYTES();
  const meta = await processMediaBytes(bytes, 'photo.png', 'image/png', PUBLISHER);
  const memo = encodeProofPayload(meta.hashDropId, meta.hash, meta.size, meta.mimeType, meta.filename);
  return { bytes, filename: meta.filename, mime: meta.mimeType, memo };
}

interface PrivateFixture {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  memo: string;
  secretKey: Uint8Array;
  artifact: ReturnType<typeof importArtifact>;
  mlKemCiphertext: Uint8Array;
}

async function simulatePrivateMediaPublish(
  bytes: Uint8Array,
  filename: string,
  mime: string
): Promise<PrivateFixture> {
  const meta = await processMediaBytes(bytes, filename, mime, PUBLISHER);
  const keypair = await generateRecipientKeypair();
  const keyFingerprint = await calculateKeyFingerprint(keypair.publicKey);
  const encryptionResult = await encryptPrivateContent(
    bytes,
    meta.hash,
    meta.mimeType,
    keypair.publicKey,
    keyFingerprint,
    meta.hashDropId,
    meta.filename
  );
  const memo = encodePrivatePayload(
    meta.hashDropId,
    encryptionResult.plaintextHash,
    encryptionResult.plaintextSize,
    encryptionResult.contentType,
    keyFingerprint,
    bytesToBase64(encryptionResult.encryptedKeyEnvelope.iv),
    bytesToBase64(encryptionResult.encryptedKeyEnvelope.encryptedKey)
  );
  return {
    bytes,
    filename: meta.filename,
    mime: meta.mimeType,
    memo,
    secretKey: keypair.secretKey,
    // Round-trip through the canonical artifact envelope exactly as the user
    // would save/import the .hdp file.
    artifact: importArtifact(exportArtifact(encryptionResult.encryptedArtifact)),
    mlKemCiphertext: encryptionResult.mlKemCiphertext,
  };
}
describe('HashDrop media lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PROOF + IMAGE', () => {
    it('verifies the exact original image bytes against the extended proof memo', async () => {
      const fixture = await simulateProofMediaPublish();
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const result: ProofVerificationResult = await verifyProofDropBytes(fakeConnection, SIGNATURE, fixture.bytes);

      expect(result.verified).toBe(true);
      expect(result.error).toBeNull();
      expect(result.mimeType).toBe('image/png');
      expect(result.filename).toBe('photo.png');
      expect(result.calculatedHash).toBe(result.contentHash);
    });

    it('fails verification when a single original byte is modified', async () => {
      const fixture = await simulateProofMediaPublish();
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const modified = fixture.bytes.slice();
      modified[modified.length - 1] = modified[modified.length - 1] ^ 0xff; // flip one byte
      const result = await verifyProofDropBytes(fakeConnection, SIGNATURE, modified);

      expect(result.verified).toBe(false);
      expect(result.calculatedHash).not.toBe(result.contentHash);
      expect(result.error).toContain('PROOF NOT VERIFIED');
    });

    it('fails verification for a truncated file', async () => {
      const fixture = await simulateProofMediaPublish();
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const truncated = fixture.bytes.slice(0, fixture.bytes.length - 8);
      const result = await verifyProofDropBytes(fakeConnection, SIGNATURE, truncated);

      expect(result.verified).toBe(false);
    });

    it('fails verification for a completely different file', async () => {
      const fixture = await simulateProofMediaPublish();
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const other = VIDEO_BYTES(); // a video, not the committed image
      const result = await verifyProofDropBytes(fakeConnection, SIGNATURE, other);

      expect(result.verified).toBe(false);
    });
  });

  describe('PROOF + VIDEO / AUDIO', () => {
    it('verifies an MP4 video commit', async () => {
      const bytes = VIDEO_BYTES();
      const meta = await processMediaBytes(bytes, 'clip.mp4', 'video/mp4', PUBLISHER);
      const memo = encodeProofPayload(meta.hashDropId, meta.hash, meta.size, meta.mimeType, meta.filename);
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(memo));

      const result = await verifyProofDropBytes(fakeConnection, SIGNATURE, bytes);
      expect(result.verified).toBe(true);
      expect(result.mimeType).toBe('video/mp4');
    });

    it('verifies a WAV voice-note commit', async () => {
      const bytes = AUDIO_BYTES();
      const meta = await processMediaBytes(bytes, 'voice.wav', 'audio/wav', PUBLISHER);
      const memo = encodeProofPayload(meta.hashDropId, meta.hash, meta.size, meta.mimeType, meta.filename);
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(memo));

      const result = await verifyProofDropBytes(fakeConnection, SIGNATURE, bytes);
      expect(result.verified).toBe(true);
      expect(result.mimeType).toBe('audio/wav');
    });
  });

  describe('PROOF + TEXT (regression)', () => {
    it('verifies text proofs via the unified memo (contentType + filename)', async () => {
      const text = 'Hello, HashDrop!';
      const bytes = new TextEncoder().encode(text);
      const hash = await calculateHash(bytes);
      const memo = encodeProofPayload('hd_text_1', hash, bytes.length, 'text/plain', '');
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(memo));

      const result = await verifyProofDrop(fakeConnection, SIGNATURE, text);
      expect(result.verified).toBe(true);
      expect(result.mimeType).toBe('text/plain');
      expect(result.filename).toBe('');
    });
  });
describe('PRIVATE + IMAGE / VIDEO / AUDIO', () => {
    it('decrypts, authenticates, and verifies a private image', async () => {
      const img = await simulatePrivateMediaPublish(IMAGE_BYTES(), 'private.png', 'image/png');
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(img.memo));

      const result: PrivateVerificationResult = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        img.secretKey,
        img.artifact,
        img.mlKemCiphertext
      );

      expect(result.verified).toBe(true);
      expect(result.error).toBeNull();
      expect(result.plaintextBytes).toBeDefined();
      expect(Buffer.from(result.plaintextBytes!).equals(Buffer.from(img.bytes))).toBe(true);
      expect(result.filename).toBe('private.png');
      expect(result.mimeType).toBe('image/png');
      expect(result.calculatedHash).toBe(result.contentHash);
    });

    it('decrypts and verifies a private video with its exact original bytes', async () => {
      const fixture = await simulatePrivateMediaPublish(VIDEO_BYTES(), 'clip.mp4', 'video/mp4');
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        fixture.secretKey,
        fixture.artifact,
        fixture.mlKemCiphertext
      );

      expect(result.verified).toBe(true);
      expect(Buffer.from(result.plaintextBytes!).equals(Buffer.from(fixture.bytes))).toBe(true);
      expect(result.mimeType).toBe('video/mp4');
    });

    it('decrypts and verifies a private voice recording', async () => {
      const fixture = await simulatePrivateMediaPublish(AUDIO_BYTES(), 'voice.wav', 'audio/wav');
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        fixture.secretKey,
        fixture.artifact,
        fixture.mlKemCiphertext
      );

      expect(result.verified).toBe(true);
      expect(Buffer.from(result.plaintextBytes!).equals(Buffer.from(fixture.bytes))).toBe(true);
      expect(result.filename).toBe('voice.wav');
      expect(isMediaMime(result.mimeType!)).toBe(true);
    });

    it('REJECTS a tampered encrypted artifact (one ciphertext byte flipped)', async () => {
      const fixture = await simulatePrivateMediaPublish(IMAGE_BYTES(), 'secret.png', 'image/png');
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const tampered = {
        ...fixture.artifact,
        ciphertext: fixture.artifact.ciphertext.slice(),
      };
      tampered.ciphertext[tampered.ciphertext.length - 1] ^= 0xff;

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        fixture.secretKey,
        tampered,
        fixture.mlKemCiphertext
      );

      // AES-GCM authentication must fail — never display corrupt plaintext as valid.
      expect(result.verified).toBe(false);
      expect(result.plaintext).toBeNull();
      expect(result.error).toContain('Decryption failed');
    });

    it('REJECTS a metadata-modification attack on the on-chain memo', async () => {
      const fixture = await simulatePrivateMediaPublish(IMAGE_BYTES(), 'secret.png', 'image/png');
      // Modify the committed content hash in the memo.
      const swappedHash = fixture.memo.replace(fixture.artifact.contentHash, 'f'.repeat(64));
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(swappedHash));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        fixture.secretKey,
        fixture.artifact,
        fixture.mlKemCiphertext
      );

      expect(result.verified).toBe(false);
    });

    it('REJECTS the wrong ML-KEM secret key', async () => {
      const fixture = await simulatePrivateMediaPublish(IMAGE_BYTES(), 'secret.png', 'image/png');
      const otherKeypair = await generateRecipientKeypair();
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(fixture.memo));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        otherKeypair.secretKey,
        fixture.artifact,
        fixture.mlKemCiphertext
      );

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Decryption failed');
    });
  });

  describe('missing / malformed artifact', () => {
    it('rejects a missing artifact envelope cleanly', () => {
      expect(() => importArtifact('')).toThrow('Invalid artifact envelope');
      expect(() => importArtifact('HASHDROP-PRIVATE-BLOB|v9|short')).toThrow();
    });

    it('rejects an artifact that does not belong to the on-chain drop', async () => {
      const published = await simulatePrivateMediaPublish(IMAGE_BYTES(), 'a.png', 'image/png');
      const other = await simulatePrivateMediaPublish(VIDEO_BYTES(), 'b.mp4', 'video/mp4');
      mockGetTransaction.mockResolvedValue(devnetV0Transaction(published.memo));

      const result = await verifyPrivateDrop(
        fakeConnection,
        SIGNATURE,
        published.secretKey,
        other.artifact, // artifact for a different drop
        other.mlKemCiphertext
      );

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Artifact does not belong to this HashDrop.');
    });
  });

  describe('wrong MIME / wrong file (creation side)', () => {
    it('rejects creating a proof from bytes that do not match the declared MIME kind', async () => {
      // Real image bytes declared as a video: cross-kind mismatch — rejected.
      await expect(processMediaBytes(IMAGE_BYTES(), 'photo.mp4', 'video/mp4', PUBLISHER)).rejects.toThrow(
        'Unsupported or unrecognized file type'
      );
      // Real video bytes declared as an image: cross-kind mismatch — rejected.
      await expect(processMediaBytes(VIDEO_BYTES(), 'photo.png', 'image/png', PUBLISHER)).rejects.toThrow();
      // Nonsense bytes declared as an image — rejected (no signature).
      await expect(processMediaBytes(new Uint8Array([9, 9, 9, 9, 9]), 'x.png', 'image/png', PUBLISHER)).rejects.toThrow();
    });
  });
});