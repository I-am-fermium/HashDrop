/**
 * DOM-level integration tests for the /viewer route (V3 UI)
 *
 * These tests mount the REAL src/app/viewer/page.tsx component inside jsdom
 * and drive the actual browser flow:
 *
 *   RETRIEVE -> verifyBySignature() (real V3 codec) -> setState -> React re-render -> mode-specific UI
 *
 * Mocked:
 *   - useWallet (provides a fake Solana connection whose getTransaction
 *     returns a synthetic transaction containing a REAL encoded V3 memo)
 *   - PRIVATE decryption primitives (keyManager / encryptedArtifact) and
 *     verifyPrivateDrop (real crypto is covered by src/lib/crypto/*.test.ts
 *     and src/lib/private.test.ts)
 *
 * Real (unmocked):
 *   - V3 payload encoding/decoding (src/lib/memo.ts)
 *   - V3 PUBLIC/PROOF/PRIVATE retrieval detection (src/lib/verification.ts)
 *   - SHA-256 hashing (src/lib/content.ts)
 *   - The complete render path: state -> JSX -> visible text
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetTransaction = jest.fn();

jest.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    publicKey: null,
    isConnected: false,
    connection: {
      // Lazy reference: invoked at render time, after module init
      getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
    },
    network: 'devnet',
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendTransaction: jest.fn(),
    wallet: null,
    setNetwork: jest.fn(),
  }),
}));

jest.mock('../../lib/crypto/keyManager', () => ({
  importSecretKey: jest.fn(() => new Uint8Array(32)),
}));

jest.mock('../../lib/crypto/encryptedArtifact', () => ({
  importArtifact: jest.fn(() => ({
    hashDropId: 'HDIDPRIVATE0001',
    contentHash: '',
    contentSize: 0,
    contentType: 'text/plain',
    keyFingerprint: 'aabbccddeeff0011',
    mlKemCiphertext: new Uint8Array(8),
    iv: new Uint8Array(12),
    ciphertext: new Uint8Array(4),
  })),
}));

jest.mock('../../lib/verification', () => {
  const actual = jest.requireActual('../../lib/verification');
  return {
    ...actual,
    verifyPrivateDrop: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import Viewer from './page';
import { verifyPrivateDrop, PrivateVerificationResult } from '../../lib/verification';
import {
  encodePublicPayload,
  encodeProofPayload,
  encodePrivatePayload,
  MEMO_PROGRAM_ID,
} from '../../lib/memo';
import { calculateHash, stringToBytes } from '../../lib/content';
import { importSecretKey } from '../../lib/crypto/keyManager';
import { importArtifact } from '../../lib/crypto/encryptedArtifact';

const mockedVerifyPrivateDrop = verifyPrivateDrop as jest.MockedFunction<typeof verifyPrivateDrop>;
const mockedImportSecretKey = importSecretKey as jest.Mock;
const mockedImportArtifact = importArtifact as jest.Mock;

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// 88 valid base58 characters (matches the page's signature validation regex)
const SIGNATURE = '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd';
const PUBLISHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const CONTENT = 'Hello HashDrop V3!';
const CONTENT_BYTES = stringToBytes(CONTENT);

/** Build a legacy-shaped RPC transaction containing a V3 memo instruction. */
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
            // Plain string payload — matches the string branch of
            // decodeInstructionData() (Node-realm TextEncoder bytes fail the
            // jsdom-realm `instanceof Uint8Array` check in tests).
            data: memo,
          },
        ],
      },
    },
  };
}

async function publicMemo(): Promise<string> {
  const hash = await calculateHash(CONTENT_BYTES);
  const base64 = Buffer.from(CONTENT_BYTES).toString('base64');
  return encodePublicPayload('HDIDPUBLIC00001', hash, 'text/plain', CONTENT_BYTES.length, base64);
}

async function proofMemo(): Promise<string> {
  const hash = await calculateHash(CONTENT_BYTES);
  return encodeProofPayload('HDIDPROOF000001', hash, CONTENT_BYTES.length, 'text/plain', '');
}

async function privateMemo(): Promise<string> {
  const hash = await calculateHash(CONTENT_BYTES);
  return encodePrivatePayload(
    'HDIDPRIVATE0001',
    hash,
    CONTENT_BYTES.length,
    'text/plain',
    'aabbccddeeff0011',
    'QUJDREVGRw==',
    'QUJDREVGR0hJSktMTU5PUg=='
  );
}

function fakePrivateVerified(): PrivateVerificationResult {
  return {
    verified: true,
    hashDropId: 'HDIDPRIVATE0001',
    contentHash: 'b'.repeat(64),
    contentSize: CONTENT_BYTES.length,
    calculatedHash: 'b'.repeat(64),
    calculatedSize: CONTENT_BYTES.length,
    contentType: 'text/plain',
    plaintext: 'Top secret payload',
    signature: SIGNATURE,
    signer: PUBLISHER,
    error: null,
    version: 'v3',
    mode: 'PRIVATE',
  };
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function renderViewer() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(React.createElement(Viewer));
  });
}

async function cleanup() {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
  }
  if (container) {
    container.remove();
  }
  root = null;
  container = null;
}

function textContent(): string {
  return container?.textContent ?? '';
}

function expectVisible(text: string) {
  expect(textContent()).toContain(text);
}

function expectNotVisible(text: string) {
  expect(textContent()).not.toContain(text);
}

function findButton(label: string): HTMLButtonElement {
  const buttons = Array.from(container?.querySelectorAll('button') ?? []);
  const btn = buttons.find((b) => (b.textContent ?? '').trim() === label);
  if (!btn) {
    throw new Error(
      `Button "${label}" not found. Visible buttons: [${buttons
        .map((b) => (b.textContent ?? '').trim())
        .join(' | ')}]`
    );
  }
  return btn as HTMLButtonElement;
}

function findInputByPlaceholderPrefix(prefix: string): HTMLInputElement {
  const inputs = Array.from(
    container?.querySelectorAll('input, textarea') ?? []
  ) as HTMLInputElement[];
  const el = inputs.find((i) => (i.getAttribute('placeholder') ?? '').startsWith(prefix));
  if (!el) {
    throw new Error(`Input with placeholder prefix "${prefix}" not found`);
  }
  return el;
}

function setInputValue(el: HTMLInputElement, value: string) {
  act(() => {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickButton(label: string) {
  const btn = findButton(label);
  await act(async () => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Poll until a condition holds (FileReader completes asynchronously in jsdom).
 */
async function waitFor(condition: () => boolean, description: string) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > 3000) {
      throw new Error(`Timeout waiting for: ${description}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

/**
 * Simulate selecting a file in a file input (jsdom has no native picker).
 * The viewer handlers read `e.target.files?.[0]`, so defining `files`
 * and dispatching a bubbling `change` event exercises the real handler.
 */
async function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Viewer page (/viewer) — V3 UI render path', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('initially renders only the retrieval form (no mode sections)', async () => {
    await renderViewer();

    expectVisible('Retrieve HashDrop');
    expectVisible('Retrieval Details');
    expectVisible('HashDrop ID (optional)');
    expect(findButton('RETRIEVE')).toBeTruthy();

    // None of the V3 result sections are visible before retrieval
    expectNotVisible('Public Drop');
    expectNotVisible('Proof Drop');
    expectNotVisible('Private Drop');
    expectNotVisible('Encrypted Artifact');
    expectNotVisible('DECRYPT & VERIFY');
  });

  it('rejects malformed signatures without any RPC call', async () => {
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), 'not-a-sig');
    await clickButton('RETRIEVE');

    expectVisible('Invalid transaction signature format');
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it('renders the failure state when the transaction cannot be found', async () => {
    mockGetTransaction.mockResolvedValue(null);
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');

    expectVisible('VERIFICATION FAILED');
    expectVisible('Transaction not found on Solana Devnet.');
  });

  it('PUBLIC: renders the Public Drop result after SHA-256 verification', async () => {
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await publicMemo()));
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');

    expectVisible('Public Drop');
    expectVisible('✓ VERIFIED');
    // Content is displayed only because the recomputed SHA-256 matched
    expectVisible('Hello HashDrop V3!');
    expectVisible('MIME Type');
    expectVisible('text/plain');
    expectVisible('Content Size');
    expectVisible(`${CONTENT_BYTES.length} bytes`);
    expectVisible('SHA-256');
    expectVisible('HashDrop ID');
    expectVisible('HDIDPUBLIC00001');
    expectVisible('Published By');
    expectVisible(PUBLISHER);
    expectVisible('Transaction Signature');
    expectVisible(SIGNATURE);
    expectVisible('View on Solana Explorer');

    // Exactly one transaction fetch: the retrieval itself
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
  });

  it('PROOF: renders the Proof Drop commitment immediately, with no content retrieval attempt', async () => {
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await proofMemo()));
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');

    expectVisible('Proof Drop');
    expectVisible('✓ ON-CHAIN COMMITMENT');
    expectVisible('This HashDrop stores a cryptographic proof/timestamp.');
    expectVisible('The original content is not stored on-chain.');
    expectVisible('To verify original content, provide the original content');
    expectVisible('compare its SHA-256 hash with the');
    expectVisible('HashDrop ID');
    expectVisible('HDIDPROOF000001');
    expectVisible('SHA-256');
    expectVisible('Content Size');
    expectVisible(`${CONTENT_BYTES.length} bytes`);
    expectVisible('Published By');
    expectVisible(PUBLISHER);
    expectVisible('Transaction Signature');
    expectVisible(SIGNATURE);

    // The stored content is NOT displayed and no additional fetch happens
    expectNotVisible('Hello HashDrop V3!');
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
  });

  it('PROOF: a SECOND consecutive failed verification still reports its failure reason (regression)', async () => {
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await proofMemo()));
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');
    expectVisible('✓ ON-CHAIN COMMITMENT');

    // First failure reports its reason.
    setInputValue(findInputByPlaceholderPrefix('Enter the original content'), 'wrong content one');
    await clickButton('VERIFY PROOF');
    expectVisible('❌ VERIFICATION FAILED');
    expectVisible('The supplied content does not match the on-chain commitment');

    // Second failure (different supplied content) must ALSO report its reason.
    // Before the fix the `&& !error` closure guard swallowed it: the banner was
    // cleared at the start of the attempt and never repopulated.
    setInputValue(findInputByPlaceholderPrefix('Enter the original content'), 'wrong content two');
    await clickButton('VERIFY PROOF');
    expectVisible('✕ NOT VERIFIED');
    expectVisible('❌ VERIFICATION FAILED');
    expectVisible('The supplied content does not match the on-chain commitment');
  });

  it('PRIVATE: renders commitment + decryption UI immediately after retrieval (before any decryption), then the decrypted result', async () => {
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await privateMemo()));
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');

    // --- Commitment UI appears WITHOUT any decryption attempt -------------
    expectVisible('🔐 Private Drop');
    expectVisible('This transaction stores a cryptographic commitment');
    expectVisible('The encrypted content itself is NOT stored on-chain.');
    expectVisible('HashDrop ID');
    expectVisible('HDIDPRIVATE0001');
    expectVisible('SHA-256');
    expectVisible('Content Size');
    expectVisible('MIME Type');
    expectVisible('text/plain');
    expectVisible('Crypto Version');
    expectVisible('HD-P2');
    expectVisible('Key Fingerprint');
    expectVisible('aabbccddeeff0011');
    expectVisible('Published By');
    expectVisible(PUBLISHER);
    expectVisible('Transaction Signature');
    expectVisible(SIGNATURE);

    // --- Decryption inputs are visible immediately -------------------------
    expectVisible('Decryption');
    expectVisible('Encrypted Artifact');
    expectVisible('ML-KEM-768 Private Key');
    expectVisible('Import Artifact File');
    expectVisible('Import Private Key File');

    // --- DECRYPT & VERIFY is disabled until both inputs exist --------------
    expect(findButton('DECRYPT & VERIFY').disabled).toBe(true);

    mockedImportSecretKey.mockReturnValue(new Uint8Array(32));
    mockedImportArtifact.mockReturnValue({
      hashDropId: 'HDIDPRIVATE0001',
      contentHash: '',
      contentSize: 0,
      contentType: 'text/plain',
      keyFingerprint: 'aabbccddeeff0011',
      mlKemCiphertext: new Uint8Array(8),
      iv: new Uint8Array(12),
      ciphertext: new Uint8Array(4),
    });
    mockedVerifyPrivateDrop.mockResolvedValue(fakePrivateVerified());

    setInputValue(
      findInputByPlaceholderPrefix('Paste artifact'),
      'HASHDROP-PRIVATE-BLOB|v1|AAECAwQFBgcICQ=='
    );

    // Still disabled: the private key is missing
    expect(findButton('DECRYPT & VERIFY').disabled).toBe(true);

    setInputValue(
      findInputByPlaceholderPrefix('Paste private key'),
      'HASHDROP-KEY|v1|AAECAwQFBgcICQ=='
    );

    // Now enabled
    expect(findButton('DECRYPT & VERIFY').disabled).toBe(false);

    await clickButton('DECRYPT & VERIFY');

    expect(mockedImportSecretKey).toHaveBeenCalledWith('HASHDROP-KEY|v1|AAECAwQFBgcICQ==');
    expect(mockedImportArtifact).toHaveBeenCalledWith('HASHDROP-PRIVATE-BLOB|v1|AAECAwQFBgcICQ==');

    // --- Decrypted & verified result is rendered ----------------------------
    expectVisible('✓ DECRYPTED & VERIFIED');
    expectVisible('On-chain SHA-256');
    expectVisible('Calculated SHA-256');
    expectVisible('Decrypted Content');
    expectVisible('Top secret payload');
    expectVisible('AES-256-GCM + ML-KEM-768 + HKDF-SHA-256');
  });

  it('PRIVATE: the file picker accepts the downloaded .hdp artifact and .txt key, then decrypt & verify succeeds', async () => {
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await privateMemo()));
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');

    expectVisible('Encrypted Artifact');
    expectVisible('ML-KEM-768 Private Key');

    // Locate the two file inputs via their labels
    const fileInputs = Array.from(
      container!.querySelectorAll('input[type="file"]')
    ) as HTMLInputElement[];
    const artifactInput = fileInputs.find((i) =>
      (i.closest('label')?.textContent ?? '').includes('Import Artifact File')
    );
    const keyInput = fileInputs.find((i) =>
      (i.closest('label')?.textContent ?? '').includes('Import Private Key File')
    );
    expect(artifactInput).toBeDefined();
    expect(keyInput).toBeDefined();

    // The artifact picker must accept the .hdp files HashDrop itself produces
    // (extension AND generic MIME), plus the previous .txt/.json conventions.
    const artifactAccept = artifactInput!.getAttribute('accept') ?? '';
    expect(artifactAccept).toContain('.hdp');
    expect(artifactAccept).toContain('application/octet-stream');
    expect(artifactAccept).toContain('text/plain');
    expect(artifactAccept).toContain('.txt');
    expect(artifactAccept).toContain('.json');

    // The private-key picker still accepts the exported .txt key file
    const keyAccept = keyInput!.getAttribute('accept') ?? '';
    expect(keyAccept).toContain('.txt');

    // Select the downloaded .hdp file — its content is the canonical artifact
    // string and must land in the existing artifact input state.
    const artifactEnvelope =
      'HASHDROP-PRIVATE-BLOB|v1|HDIDPRIVATE0001|' + 'c'.repeat(64) +
      '|18|text/plain|HD-P2|aabbccddeeff0011|QUJDREVGRw==|QUJDREVGR0hJSktMTU5PUg==|QUJDREVGR0hJSktMTU5PUg==';
    const artifactFile = new File([artifactEnvelope], 'hashdrop-private-HDIDPRIVATE0001.hdp', {
      type: 'application/octet-stream',
    });
    await selectFile(artifactInput!, artifactFile);
    await waitFor(
      () => findInputByPlaceholderPrefix('Paste artifact').value === artifactEnvelope,
      '.hdp artifact file import'
    );

    // Select the exported .txt private key file
    const keyEnvelope = 'HASHDROP-KEY|v1|ML-KEM-768|AAECAwQFBgcICQ==';
    const keyFile = new File(
      [keyEnvelope],
      'hashdrop-mlkem-768-private-key-aabbccddeeff0011.txt',
      { type: 'text/plain' }
    );
    await selectFile(keyInput!, keyFile);
    await waitFor(
      () => findInputByPlaceholderPrefix('Paste private key').value === keyEnvelope,
      '.txt key file import'
    );

    // Enabled from file imports alone (no pasting)
    expect(findButton('DECRYPT & VERIFY').disabled).toBe(false);

    // The existing import/verify pipeline consumes both files
    mockedImportSecretKey.mockReturnValue(new Uint8Array(32));
    mockedImportArtifact.mockReturnValue({
      hashDropId: 'HDIDPRIVATE0001',
      contentHash: '',
      contentSize: 0,
      contentType: 'text/plain',
      keyFingerprint: 'aabbccddeeff0011',
      mlKemCiphertext: new Uint8Array(8),
      iv: new Uint8Array(12),
      ciphertext: new Uint8Array(4),
    });
    mockedVerifyPrivateDrop.mockResolvedValue(fakePrivateVerified());

    await clickButton('DECRYPT & VERIFY');

    expect(mockedImportArtifact).toHaveBeenCalledWith(artifactEnvelope);
    expect(mockedImportSecretKey).toHaveBeenCalledWith(keyEnvelope);
    expectVisible('✓ DECRYPTED & VERIFIED');
  });

  it('PRIVATE: a tampered artifact is still rejected by the existing verification flow', async () => {
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await privateMemo()));
    await renderViewer();

    setInputValue(findInputByPlaceholderPrefix('Enter Solana transaction signature'), SIGNATURE);
    await clickButton('RETRIEVE');

    // Paste a tampered artifact (one flipped ciphertext byte) via the
    // still-working paste path, and a structurally valid key envelope.
    const tamperedArtifact =
      'HASHDROP-PRIVATE-BLOB|v1|HDIDPRIVATE0001|' + 'c'.repeat(64) +
      '|18|text/plain|HD-P2|aabbccddeeff0011|QUJDREVGRw==|QUJDREVGR0hJSktMTU5PUg==|QUJDREVGR0hJSktMTU5PUgx';
    const keyEnvelope = 'HASHDROP-KEY|v1|ML-KEM-768|AAECAwQFBgcICQ==';

    mockedImportSecretKey.mockReturnValue(new Uint8Array(32));
    mockedImportArtifact.mockReturnValue({
      hashDropId: 'HDIDPRIVATE0001',
      contentHash: '',
      contentSize: 0,
      contentType: 'text/plain',
      keyFingerprint: 'aabbccddeeff0011',
      mlKemCiphertext: new Uint8Array(8),
      iv: new Uint8Array(12),
      ciphertext: new Uint8Array(4),
    });
    mockedVerifyPrivateDrop.mockResolvedValue({
      ...fakePrivateVerified(),
      verified: false,
      plaintext: null,
      error: 'Decryption failed: invalid key or tampered ciphertext',
    });

    setInputValue(findInputByPlaceholderPrefix('Paste artifact'), tamperedArtifact);
    setInputValue(findInputByPlaceholderPrefix('Paste private key'), keyEnvelope);
    await clickButton('DECRYPT & VERIFY');

    // The existing verification flow rejects it — no decrypted result panel
    expectNotVisible('✓ DECRYPTED & VERIFIED');
    expectVisible('VERIFICATION FAILED');
    expectVisible('Decryption failed: invalid key or tampered ciphertext');
    // The PRIVATE commitment/decryption UI remains for another attempt
    expectVisible('🔐 Private Drop');
  });

  it('accepts the real 87-character Mainnet signature (Base58 64-byte) and normalizes padded input', async () => {
    // Real Mainnet Beta transaction — 87 chars, previously rejected by the
    // hard-coded `length < 88` validation before any RPC call.
    const MAINNET_SIGNATURE =
      'RhpUZ6jSGfcwF8oc1PVhqLQLneDx9zsoearLCgv58f2pqi1KWWHGCBpjDRgTYpChruTVh2bqXSDXCGEqmnx381e';
    expect(MAINNET_SIGNATURE.length).toBe(87);

    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await privateMemo()));
    await renderViewer();

    // Paste with surrounding whitespace — must be normalized, not rejected
    setInputValue(
      findInputByPlaceholderPrefix('Enter Solana transaction signature'),
      `  ${MAINNET_SIGNATURE}\n`
    );
    await clickButton('RETRIEVE');

    // Signature accepted -> retrieval ran with the TRIMMED value ->
    // the PRIVATE commitment UI appears.
    expectVisible('🔐 Private Drop');
    expectVisible('Encrypted Artifact');
    expect(mockGetTransaction).toHaveBeenCalledTimes(1);
    expect(mockGetTransaction).toHaveBeenCalledWith(MAINNET_SIGNATURE, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 1,
    });
  });
});
