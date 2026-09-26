/**
 * Retrieve regressions: which cluster a lookup actually used, wrong-network
 * lookups, and transaction-version handling of the RPC read path.
 *
 * The transport itself (timeout / retry / abort / not-found) is covered by
 * src/lib/solana/transactionRead.test.ts, so here the bounded read is replaced
 * by a controllable mock and the Connection doubles only have to identify the
 * cluster they represent (`rpcEndpoint`), exactly like a real web3.js
 * Connection. No network access happens in this file.
 */

import type { Connection } from '@solana/web3.js';

const mockBoundedRead = jest.fn();

jest.mock('./solana/transactionRead', () => {
  const actual = jest.requireActual('./solana/transactionRead');
  return {
    ...actual,
    getTransactionBounded: (...args: unknown[]) => mockBoundedRead(...args),
  };
});

import { verifyPublicDrop } from './verification';
import { NETWORK_CONFIGS, getNetworkForRpcEndpoint } from './network';
import { encodePublicPayload, MEMO_PROGRAM_ID } from './memo';
import { calculateHash, stringToBytes } from './content';

const CONTENT = 'Retrieve network regression';
const CONTENT_BYTES = stringToBytes(CONTENT);
const PUBLISHER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const SIGNATURE =
  '3xKQ9mVtN7pRjWcYdLfBhGsaZuErTuXoMkCiAhPqDwSyFnJgLeZbHmVaCoXitPukRjWnQeSyAdGfBhZtLmVcKqWd';
const UNKNOWN_ENDPOINT = 'https://custom-rpc.example/rpc';

const MAINNET_ENDPOINT = NETWORK_CONFIGS.mainnet.rpcUrl;
const DEVNET_ENDPOINT = NETWORK_CONFIGS.devnet.rpcUrl;

/** Connection double that identifies its cluster, like a real Connection. */
function connectionDouble(rpcEndpoint: string): Connection {
  return { rpcEndpoint } as unknown as Connection;
}

async function publicMemo(): Promise<string> {
  const hash = await calculateHash(CONTENT_BYTES);
  const base64 = Buffer.from(CONTENT_BYTES).toString('base64');
  return encodePublicPayload('hd_nettest_01', hash, 'text/plain', CONTENT_BYTES.length, base64);
}

/** legacy (json) response: accountKeys + instructions, no version field. */
function legacyTx(memo: string) {
  return {
    slot: 1,
    blockTime: 1,
    meta: { err: null },
    transaction: {
      message: {
        accountKeys: [PUBLISHER, MEMO_PROGRAM_ID],
        instructions: [{ programId: MEMO_PROGRAM_ID, accounts: [], data: memo }],
      },
    },
  };
}

/** v0 response: staticAccountKeys + compiledInstructions (Buffer data). */
function v0Tx(memo: string) {
  return {
    version: 0,
    slot: 1,
    blockTime: 1,
    meta: { err: null },
    transaction: {
      message: {
        header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 2 },
        staticAccountKeys: [PUBLISHER, MEMO_PROGRAM_ID],
        recentBlockhash: '11111111111111111111111111111111',
        compiledInstructions: [
          { programIdIndex: 1, accountKeyIndexes: [], data: Buffer.from(memo, 'utf8') },
        ],
      },
    },
  };
}

/** v1 response: like v0 plus the v1 transactionConfig block. */
function v1Tx(memo: string) {
  return {
    version: 1,
    slot: 1,
    blockTime: 1,
    meta: { err: null },
    transaction: {
      message: {
        header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 2 },
        staticAccountKeys: [PUBLISHER, MEMO_PROGRAM_ID],
        recentBlockhash: '11111111111111111111111111111111',
        compiledInstructions: [
          { programIdIndex: 1, accountKeyIndexes: [], data: Buffer.from(memo, 'utf8') },
        ],
        // Present on a real v1 response (web3.js requires it); Retrieve does not read it.
        transactionConfig: {
          computeUnitLimit: 200000,
          loadedAccountsDataSizeLimit: 0,
          heapSize: 32768,
          priorityFee: 0,
        },
      },
    },
  };
}

beforeEach(() => {
  mockBoundedRead.mockReset();
});


describe('Retrieve — cluster diagnostics', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('identifies the configured cluster endpoints and rejects unknown ones', () => {
    expect(getNetworkForRpcEndpoint(MAINNET_ENDPOINT)).toBe('mainnet');
    expect(getNetworkForRpcEndpoint(DEVNET_ENDPOINT)).toBe('devnet');
    expect(getNetworkForRpcEndpoint(UNKNOWN_ENDPOINT)).toBeNull();
    expect(getNetworkForRpcEndpoint('')).toBeNull();
  });

  it('names the cluster that ANSWERED, not the separately stored selection', async () => {
    // The stored selection says Devnet while the Mainnet endpoint answered.
    window.localStorage.setItem('hashdrop-network', 'devnet');
    mockBoundedRead.mockResolvedValue(null);

    const result = await verifyPublicDrop(connectionDouble(MAINNET_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(false);
    expect(result.error).toBe('Transaction not found on Solana Mainnet (Beta).');
  });

  it('names Devnet when the Devnet endpoint answered', async () => {
    window.localStorage.setItem('hashdrop-network', 'mainnet');
    mockBoundedRead.mockResolvedValue(null);

    const result = await verifyPublicDrop(connectionDouble(DEVNET_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(false);
    expect(result.error).toBe('Transaction not found on Solana Devnet.');
  });

  it('falls back to the selected network for an unrecognised endpoint', async () => {
    window.localStorage.setItem('hashdrop-network', 'mainnet');
    mockBoundedRead.mockResolvedValue(null);

    const result = await verifyPublicDrop(connectionDouble(UNKNOWN_ENDPOINT), SIGNATURE);

    expect(result.error).toBe('Transaction not found on Solana Mainnet (Beta).');
  });

  it('fails closed on a wrong-network lookup (no transaction, no content)', async () => {
    // A Mainnet signature looked up through the Devnet endpoint.
    mockBoundedRead.mockResolvedValue(null);

    const result = await verifyPublicDrop(connectionDouble(DEVNET_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(false);
    expect(result.content).toBe('');
    expect(result.contentHash).toBe('');
    expect(result.hash).toBe('');
  });
});

describe('Retrieve — transaction version handling', () => {
  it('requests maxSupportedTransactionVersion 1 so legacy, v0 and v1 are all readable', async () => {
    mockBoundedRead.mockResolvedValue(legacyTx(await publicMemo()));

    await verifyPublicDrop(connectionDouble(UNKNOWN_ENDPOINT), SIGNATURE);

    expect(mockBoundedRead).toHaveBeenCalledWith(expect.anything(), SIGNATURE, {
      maxSupportedTransactionVersion: 1,
    });
  });

  it('verifies a legacy transaction response', async () => {
    mockBoundedRead.mockResolvedValue(legacyTx(await publicMemo()));

    const result = await verifyPublicDrop(connectionDouble(UNKNOWN_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(true);
    expect(result.transactionVersion).toBe('legacy');
    expect(result.content).toBe(CONTENT);
    expect(result.hash).toBe(result.contentHash);
  });

  it('verifies a v0 transaction response (staticAccountKeys + compiledInstructions)', async () => {
    mockBoundedRead.mockResolvedValue(v0Tx(await publicMemo()));

    const result = await verifyPublicDrop(connectionDouble(UNKNOWN_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(true);
    expect(result.transactionVersion).toBe('v0');
    expect(result.content).toBe(CONTENT);
  });

  it('verifies a v1 transaction response and reports version v1', async () => {
    mockBoundedRead.mockResolvedValue(v1Tx(await publicMemo()));

    const result = await verifyPublicDrop(connectionDouble(UNKNOWN_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(true);
    expect(result.transactionVersion).toBe('v1');
    expect(result.content).toBe(CONTENT);
    expect(result.hash).toBe(result.contentHash);
  });

  it('fails closed when the recovered bytes do not match the on-chain hash', async () => {
    const tampered = (await publicMemo()).replace(/[0-9a-f]{64}/, 'a'.repeat(64));
    mockBoundedRead.mockResolvedValue(legacyTx(tampered));

    const result = await verifyPublicDrop(connectionDouble(UNKNOWN_ENDPOINT), SIGNATURE);

    expect(result.verified).toBe(false);
    expect(result.content).toBe('');
    expect(result.error).toContain('CONTENT VERIFICATION FAILED');
  });
});

describe('Retrieve — Mainnet endpoint selection', () => {
  const ORIGINAL_MAINNET = process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC;
  const TEST_ENDPOINT = 'https://mainnet.example.test/?api-key=TESTKEY';

  afterEach(() => {
    if (ORIGINAL_MAINNET === undefined) {
      delete process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC;
    } else {
      process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC = ORIGINAL_MAINNET;
    }
    window.localStorage.clear();
  });

  it('builds Mainnet connections from the CONFIGURED endpoint, never the redacted logging form', () => {
    window.localStorage.setItem('hashdrop-network', 'mainnet');
    process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC = TEST_ENDPOINT;

    jest.isolateModules(() => {
      const network = require('./network') as typeof import('./network');
      const cost = require('./solana/networkCost') as typeof import('./solana/networkCost');

      // Every Mainnet connection (including Retrieve's fallback) must use the
      // configured endpoint verbatim — a redacted '?api-key=[REDACTED]' URL
      // answers 401 Unauthorized, which broke Mainnet Retrieve.
      expect(network.getRpcUrl()).toBe(TEST_ENDPOINT);
      expect(network.createConnection().rpcEndpoint).toBe(TEST_ENDPOINT);
      expect(network.MAINNET_RPC).toBe(TEST_ENDPOINT);
      expect(network.NETWORK_CONFIGS.mainnet.rpcUrl).toBe(TEST_ENDPOINT);
      expect(cost.getConnection().rpcEndpoint).toBe(TEST_ENDPOINT);

      // Logging still redacts the key.
      expect(network.getRpcUrlForLogging()).toContain('REDACTED');
    });
  });
});

