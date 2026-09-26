/**
 * Tests for the bounded Retrieve read path (src/lib/solana/transactionRead.ts).
 *
 * Focus: Retrieve must never hang forever on an unresponsive RPC, retries must
 * be bounded, and a definitive answer (not found / non-transient RPC error)
 * must fail closed instead of being retried.
 *
 * READ-ONLY: these tests never sign, send or duplicate a transaction.
 *
 * Runs in the project's default jsdom environment (the same environment the
 * other retrieval suites use); the abortable-transport test replaces
 * `globalThis.fetch` with a silent endpoint so the abort path is exercised
 * without a live RPC.
 */

import { Connection } from '@solana/web3.js';
import {
  getTransactionBounded,
  RETRIEVAL_MAX_ATTEMPTS,
  RETRIEVAL_RETRY_DELAY_MS,
  RETRIEVAL_TIMEOUT_MS,
} from './transactionRead';

/** Connection double WITHOUT `rpcEndpoint` (the app's test-double shape). */
function doubleConnection(getTransaction: jest.Mock): Connection {
  return { getTransaction } as unknown as Connection;
}

const CONFIG = { maxSupportedTransactionVersion: 1 } as const;

describe('bounded Retrieve read', () => {
  it('uses bounded defaults (a timeout and a small attempt cap)', () => {
    expect(RETRIEVAL_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RETRIEVAL_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(RETRIEVAL_MAX_ATTEMPTS).toBeGreaterThanOrEqual(1);
    expect(RETRIEVAL_MAX_ATTEMPTS).toBeLessThanOrEqual(5);
    expect(RETRIEVAL_RETRY_DELAY_MS).toBeGreaterThanOrEqual(0);
    expect(RETRIEVAL_RETRY_DELAY_MS).toBeLessThanOrEqual(2_000);
  });

  it('returns the transaction and passes commitment + maxSupportedTransactionVersion through', async () => {
    const tx = { slot: 123, version: 0 };
    const getTransaction = jest.fn().mockResolvedValue(tx);

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', CONFIG)
    ).resolves.toBe(tx);

    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(getTransaction).toHaveBeenCalledWith('SIG', {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 1,
    });
  });

  it('treats "transaction not found" (null) as definitive and does NOT retry', async () => {
    const getTransaction = jest.fn().mockResolvedValue(null);

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', CONFIG)
    ).resolves.toBeNull();

    expect(getTransaction).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure and succeeds within the bounded attempt count', async () => {
    const tx = { slot: 7 };
    const getTransaction = jest
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValueOnce(new Error('Transaction retrieval timed out after 50 ms'))
      .mockResolvedValue(tx);

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', {
        ...CONFIG,
        timeoutMs: 50,
        maxAttempts: 5,
        retryDelayMs: 5,
      })
    ).resolves.toBe(tx);

    expect(getTransaction).toHaveBeenCalledTimes(3);
  });

  it('retries the transient Devnet storage error (-32019)', async () => {
    const tx = { slot: 9 };
    const getTransaction = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Failed to query long-term storage; please try again'), { code: -32019 })
      )
      .mockResolvedValue(tx);

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', {
        ...CONFIG,
        timeoutMs: 50,
        maxAttempts: 2,
        retryDelayMs: 5,
      })
    ).resolves.toBe(tx);

    expect(getTransaction).toHaveBeenCalledTimes(2);
  });

  it('stops after the bounded attempt count and fails with a clear error', async () => {
    const getTransaction = jest.fn().mockRejectedValue(new Error('fetch failed'));

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', {
        ...CONFIG,
        timeoutMs: 50,
        maxAttempts: 3,
        retryDelayMs: 5,
      })
    ).rejects.toThrow(
      /Transaction retrieval failed: fetch failed \(3 attempts, 50 ms timeout each\)/
    );

    expect(getTransaction).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry a non-transient RPC error (e.g. -32015 unsupported version)', async () => {
    const error = Object.assign(
      new Error('Transaction version (0) is not supported by the requesting client'),
      { code: -32015 }
    );
    const getTransaction = jest.fn().mockRejectedValue(error);

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', {
        ...CONFIG,
        timeoutMs: 50,
        maxAttempts: 3,
        retryDelayMs: 5,
      })
    ).rejects.toThrow(/Transaction version \(0\) is not supported by the requesting client/);

    expect(getTransaction).toHaveBeenCalledTimes(1);
  });

  it('fails closed BOUNDED when the read never settles (no permanent hang)', async () => {
    // The exact production symptom: the RPC accepts the request and never answers.
    const getTransaction = jest.fn(() => new Promise(() => undefined));
    const started = Date.now();

    await expect(
      getTransactionBounded(doubleConnection(getTransaction), 'SIG', {
        ...CONFIG,
        timeoutMs: 40,
        maxAttempts: 2,
        retryDelayMs: 5,
      })
    ).rejects.toThrow(/timed out after 40 ms/);

    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('production path: abortable fetch (AbortController)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('aborts a silent RPC endpoint and reports a bounded retrieval error', async () => {
    // A transport that accepts the request and NEVER answers — exactly what
    // api.devnet.solana.com did for getTransaction on 2026-09-26. The only way
    // out is the AbortController fired by the bounded read.
    const signals: AbortSignal[] = [];
    const fetchMock = jest.fn((_input: unknown, init?: { signal?: AbortSignal }) => {
      const signal = init?.signal as AbortSignal;
      signals.push(signal);
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))
        );
      });
    });
    (globalThis as { fetch: unknown }).fetch = fetchMock;

    // The double exposes `rpcEndpoint` (as a real web3.js Connection does) and
    // throws if its own getTransaction is used, proving the abortable Connection
    // path ran instead of the race fallback.
    const connection = {
      rpcEndpoint: 'https://silent.invalid/rpc',
      getTransaction: () => {
        throw new Error('must not be used: abortable Connection path expected');
      },
    } as unknown as Connection;

    const started = Date.now();
    const error = await getTransactionBounded(connection, 'SIG', {
      maxSupportedTransactionVersion: 1,
      timeoutMs: 40,
      maxAttempts: 2,
      retryDelayMs: 5,
    }).catch((e: Error) => e);
    const elapsed = Date.now() - started;

    expect(error).toBeInstanceOf(Error);
    const message = String((error as Error).message);
    // The request was really aborted at the timeout — not silently ignored.
    expect(message).toMatch(/abort|timed out/i);
    expect(message).not.toContain('must not be used');
    // Bounded: exactly maxAttempts HTTP requests, each one aborted.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(elapsed).toBeLessThan(2_000);
  });
});

