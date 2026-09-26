/**
 * Viewer RETRIEVE terminal-state tests.
 *
 * During the 2026-09-26 Devnet incident the UI stayed on "Retrieving…" forever
 * because the RPC never answered getTransaction. Retrieve now reads through the
 * bounded path (src/lib/solana/transactionRead.ts), so a retrieval attempt
 * ALWAYS reaches a terminal state. These tests drive the REAL /viewer component
 * with the REAL verification pipeline and assert that a retrieval failure is
 * surfaced as an error — never as a success, and never as an endless spinner.
 *
 * Mocked:
 *   - useWallet (provides a connection double)
 *   - the bounded read helper, so a timeout/failed-retries outcome can be
 *     injected without waiting 3 × 12 s. The real timeout/retry mechanics are
 *     covered by src/lib/solana/transactionRead.test.ts.
 *
 * Real: the viewer component, state machine, V3 codec, SHA-256 verification.
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

const mockGetTransaction = jest.fn();
const mockBoundedRead = jest.fn();

jest.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    publicKey: null,
    isConnected: false,
    connection: {
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

jest.mock('../../lib/solana/transactionRead', () => {
  const actual = jest.requireActual('../../lib/solana/transactionRead');
  return {
    ...actual,
    getTransactionBounded: (...args: unknown[]) => mockBoundedRead(...args),
  };
});

import Viewer from './page';
import {
  RETRIEVAL_MAX_ATTEMPTS,
  RETRIEVAL_TIMEOUT_MS,
} from '../../lib/solana/transactionRead';
import { encodePublicPayload, MEMO_PROGRAM_ID } from '../../lib/memo';
import { calculateHash, stringToBytes } from '../../lib/content';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// 88 valid base58 characters
const SIGNATURE =
  '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd';
const PUBLISHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const CONTENT = 'Hello HashDrop V3!';
const CONTENT_BYTES = stringToBytes(CONTENT);

/** The exact error the bounded read produces after its attempts are exhausted. */
const RETRIEVAL_TIMEOUT_ERROR =
  `Transaction retrieval failed: Transaction retrieval timed out after ${RETRIEVAL_TIMEOUT_MS} ms ` +
  `(${RETRIEVAL_MAX_ATTEMPTS} attempts, ${RETRIEVAL_TIMEOUT_MS} ms timeout each).`;

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
          { programId: MEMO_PROGRAM_ID, accounts: [], data: memo },
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
  return (container?.textContent ?? '').replace(/\s+/g, ' ');
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

function findSignatureInput(): HTMLInputElement {
  const inputs = Array.from(container?.querySelectorAll('input') ?? []) as HTMLInputElement[];
  const el = inputs.find((i) =>
    (i.getAttribute('placeholder') ?? '').startsWith('Enter Solana transaction signature')
  );
  if (!el) {
    throw new Error('Signature input not found');
  }
  return el;
}

function setInputValue(el: HTMLInputElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickRetrieve() {
  const btn = findButton('RETRIEVE');
  await act(async () => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Viewer RETRIEVE — terminal state when the RPC read fails', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Default: delegate to the REAL bounded read over the connection double.
    // (The imported module is the mock wrapper, so the real implementation must
    // come from jest.requireActual.)
    mockBoundedRead.mockImplementation((...args: unknown[]) => {
      const real = jest.requireActual('../../lib/solana/transactionRead');
      return real.getTransactionBounded(...(args as [never, never, never]));
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('shows a retrieval error instead of remaining on "Retrieving…"', async () => {
    mockBoundedRead.mockImplementationOnce(() => Promise.reject(new Error(RETRIEVAL_TIMEOUT_ERROR)));

    await renderViewer();
    setInputValue(findSignatureInput(), SIGNATURE);
    await clickRetrieve();

    // Terminal error state, with the retrieval error surfaced verbatim.
    expectVisible('VERIFICATION FAILED');
    expectVisible('Transaction retrieval failed');
    expectVisible(String(RETRIEVAL_TIMEOUT_MS));

    // No permanent spinner: the button returned to its idle, enabled state.
    expect(textContent()).not.toContain('Retrieving...');
    expect(findButton('RETRIEVE').disabled).toBe(false);
  });

  it('never converts a retrieval failure into a verification success', async () => {
    mockBoundedRead.mockImplementationOnce(() => Promise.reject(new Error(RETRIEVAL_TIMEOUT_ERROR)));

    await renderViewer();
    setInputValue(findSignatureInput(), SIGNATURE);
    await clickRetrieve();

    expectNotVisible('✓ VERIFIED');
    expectNotVisible('Public Drop');
    expectNotVisible('Proof Drop');
    expectNotVisible('Private Drop');
    expectNotVisible('DECRYPT & VERIFY');
  });

  it('allows a later retrieval to succeed after a failed attempt', async () => {
    mockBoundedRead.mockImplementationOnce(() => Promise.reject(new Error(RETRIEVAL_TIMEOUT_ERROR)));

    await renderViewer();
    setInputValue(findSignatureInput(), SIGNATURE);
    await clickRetrieve();
    expectVisible('VERIFICATION FAILED');

    // The failure is not sticky: a working read verifies normally.
    mockGetTransaction.mockResolvedValue(fakeTxWithMemo(await publicMemo()));
    await clickRetrieve();

    expectVisible('Public Drop');
    expectVisible('✓ VERIFIED');
    expectVisible(CONTENT);
    expect(textContent()).not.toContain('VERIFICATION FAILED');
  });
});
