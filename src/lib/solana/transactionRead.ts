/**
 * HashDrop Bounded Transaction Read (RETRIEVE ONLY)
 *
 * Performs `getTransaction` with:
 *   - a hard per-attempt timeout backed by AbortController (the underlying HTTP
 *     request is actually aborted, not merely ignored), and
 *   - a small, bounded number of retries for transient failures.
 *
 * Why this exists: a Solana RPC endpoint can stop answering `getTransaction`
 * entirely. During the 2026-09-26 Devnet incident `api.devnet.solana.com`
 * returned no response at all for ledger-body reads (getTransaction/getBlock)
 * while answering getHealth/getLatestBlockhash/getSignatureStatuses normally,
 * and it also returned `-32019 "Failed to query long-term storage; please try
 * again"`. web3.js's `Connection.getTransaction()` has NO timeout, so Retrieve
 * waited forever and the UI stayed in its FETCHING state ("Retrieving…")
 * indefinitely.
 *
 * Guarantees:
 *   - READ ONLY. This module never signs, sends, confirms or resubmits a
 *     transaction, so it can never produce a duplicate on-chain transaction.
 *   - Every attempt reaches a terminal state: success (transaction or null =
 *     not found) or a thrown error.
 *   - Retries are bounded and only apply to transient failures/timeouts; a
 *     definitive answer (null = not found, or a non-transient RPC error) is
 *     never retried.
 *   - It never changes verification semantics: a retrieval failure is an error,
 *     never a verification success.
 */

import { Connection, VersionedTransactionResponse } from '@solana/web3.js';
import type { FetchFn } from '@solana/web3.js';

/** Per-attempt timeout for a Retrieve read. */
export const RETRIEVAL_TIMEOUT_MS = 12_000;

/** Total attempts (1 initial read + retries) for transient failures. */
export const RETRIEVAL_MAX_ATTEMPTS = 3;

/** Delay between retry attempts. */
export const RETRIEVAL_RETRY_DELAY_MS = 400;

/**
 * JSON-RPC error codes worth one more attempt (transient by nature).
 */
const RETRYABLE_RPC_CODES: ReadonlySet<number> = new Set([
  -32019, // "Failed to query long-term storage; please try again" (observed on Devnet)
  -32004, // block not available yet
  -32005, // node is behind the cluster
  -32429, // rate limited
  -32603, // internal error
]);

/**
 * Transient transport signatures (fetch/undici/node error messages).
 * A definitive answer such as "-32015 unsupported transaction version" or
 * "-32602 invalid params" does NOT match and is therefore never retried.
 */
const TRANSIENT_MESSAGE_PATTERN =
  /abort|timed? ?out|timeout|fetch failed|network|socket hang up|ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR|Bad Gateway|Gateway Timeout|Service Unavailable|Too Many Requests|Internal Server Error/i;

export interface BoundedTransactionReadOptions {
  /** RPC `maxSupportedTransactionVersion` (1 reads legacy, v0 and v1). */
  maxSupportedTransactionVersion: number;
  /** Per-attempt timeout in ms (defaults to RETRIEVAL_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Total attempts including the first (defaults to RETRIEVAL_MAX_ATTEMPTS). */
  maxAttempts?: number;
  /** Delay between attempts in ms (defaults to RETRIEVAL_RETRY_DELAY_MS). */
  retryDelayMs?: number;
}

/**
 * Build a fetch() that aborts its HTTP request after `timeoutMs`.
 *
 * web3.js accepts a `fetch` in ConnectionConfig, which is the supported way to
 * bound a Connection's requests without touching the RPC layer: the
 * AbortController tears the request down so a silent endpoint cannot hold a
 * socket open forever.
 */
function createAbortableFetch(timeoutMs: number) {
  return async (input: unknown, init?: Record<string, unknown>): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await (globalThis.fetch as typeof fetch)(input as RequestInfo | URL, {
        ...(init as RequestInit),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

// Bounded connections are cached per (endpoint, timeout): the objects are cheap
// but caching keeps the retry loop allocation-free.
const boundedConnections = new Map<string, Connection>();

function getBoundedConnection(endpoint: string, timeoutMs: number): Connection {
  const key = `${timeoutMs}|${endpoint}`;
  const cached = boundedConnections.get(key);
  if (cached) {
    return cached;
  }
  const connection = new Connection(endpoint, {
    commitment: 'confirmed',
    fetch: createAbortableFetch(timeoutMs) as unknown as FetchFn,
  });
  boundedConnections.set(key, connection);
  return connection;
}

/** Error used when a read attempt exceeds its timeout. */
function timeoutError(timeoutMs: number): Error {
  const error = new Error(`Transaction retrieval timed out after ${timeoutMs} ms`);
  error.name = 'TimeoutError';
  return error;
}

/**
 * Resolve with `promise`, or reject if it has not settled within `timeoutMs`.
 *
 * Used only for Connection objects that do not expose an `rpcEndpoint` (e.g.
 * test doubles) so that such transports are still bounded.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(timeoutError(timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** True when an error is transient and therefore worth another attempt. */
function isRetryable(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const err = error as { name?: unknown; message?: unknown; code?: unknown };

  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return true;
  }

  const code = typeof err.code === 'number' ? err.code : Number(err.code);
  if (Number.isFinite(code) && RETRYABLE_RPC_CODES.has(code)) {
    return true;
  }

  return TRANSIENT_MESSAGE_PATTERN.test(String(err.message ?? ''));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One read attempt. Returns null when the RPC reports "transaction not found". */
async function readTransaction(
  connection: Connection,
  signature: string,
  config: { commitment: 'confirmed'; maxSupportedTransactionVersion: number },
  timeoutMs: number
): Promise<VersionedTransactionResponse | null> {
  const endpoint = (connection as unknown as { rpcEndpoint?: unknown }).rpcEndpoint;
  const canAbort =
    typeof endpoint === 'string' && endpoint.length > 0 && typeof globalThis.fetch === 'function';

  if (canAbort) {
    // Production path: a bounded Connection whose fetch is really aborted.
    const bounded = getBoundedConnection(endpoint as string, timeoutMs);
    return await bounded.getTransaction(signature, config);
  }

  // Fallback (Connection double without an endpoint, or a runtime without
  // fetch): still bounded by a race so Retrieve can never hang forever.
  return await withTimeout(connection.getTransaction(signature, config), timeoutMs);
}

/**
 * Read a transaction with a bounded timeout and a bounded number of retries.
 *
 * @returns the transaction response, or null when the RPC reports the
 *          transaction as not found (a definitive answer — never retried).
 * @throws  Error when every attempt failed transiently (timeout / network /
 *          transient RPC error), or immediately for a non-transient RPC error.
 */
export async function getTransactionBounded(
  connection: Connection,
  signature: string,
  options: BoundedTransactionReadOptions
): Promise<VersionedTransactionResponse | null> {
  const timeoutMs = options.timeoutMs ?? RETRIEVAL_TIMEOUT_MS;
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? RETRIEVAL_MAX_ATTEMPTS));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? RETRIEVAL_RETRY_DELAY_MS);
  const config = {
    commitment: 'confirmed' as const,
    maxSupportedTransactionVersion: options.maxSupportedTransactionVersion,
  };

  let attempts = 0;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      return await readTransaction(connection, signature, config, timeoutMs);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts || !isRetryable(error)) {
        break;
      }

      console.warn('[HashDrop Retrieve] Retrying transaction read', {
        attempt,
        maxAttempts,
        reason: error instanceof Error ? error.message : String(error),
      });

      await delay(retryDelayMs);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  const error = new Error(
    `Transaction retrieval failed: ${reason} (${attempts} attempt${attempts === 1 ? '' : 's'}, ` +
      `${timeoutMs} ms timeout each).`
  );
  (error as Error & { cause?: unknown }).cause = lastError;
  throw error;
}

