/**
 * Regression tests for the Retrieve network/Connection lifecycle.
 *
 * Bug: the network-change effect was skipped whenever the newly selected
 * network was 'devnet' (`if (network !== 'devnet') { ... }`), so a Mainnet ->
 * Devnet switch left the stale Mainnet Connection in React state. Retrieve then
 * queried the Mainnet cluster (and reported against it) while the UI showed
 * Devnet. The Connection must be replaced on EVERY selection change, in both
 * directions.
 *
 * The network module is mocked so a "Connection" is just an object recording the
 * network it was built for — no RPC traffic, no wallet. Switching is driven
 * through a button that calls the same `setNetwork` the NetworkSelector uses.
 */

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';

const mockSelection = { network: 'mainnet' as 'devnet' | 'mainnet', created: 0 };
const mockCreateConnection = jest.fn();

jest.mock('../lib/network', () => {
  const actual = jest.requireActual('../lib/network');
  return {
    ...actual,
    getCurrentNetwork: () => mockSelection.network,
    setCurrentNetwork: (network: 'devnet' | 'mainnet') => {
      mockSelection.network = network;
    },
    createConnection: () => mockCreateConnection(),
    getRpcUrlForLogging: () => `https://${mockSelection.network}.example/rpc`,
  };
});

import { useWallet } from './useWallet';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** Renders the hook's network + Connection identity into the DOM. */
function WalletProbe() {
  const { network, connection, setNetwork } = useWallet();
  const conn = connection as unknown as { rpcEndpoint?: string; id?: number } | null;

  return React.createElement(
    'div',
    null,
    React.createElement('span', { id: 'probe-network' }, network),
    React.createElement('span', { id: 'probe-endpoint' }, conn?.rpcEndpoint ?? ''),
    React.createElement('span', { id: 'probe-connection-id' }, String(conn?.id ?? '')),
    React.createElement('button', { id: 'probe-to-devnet', onClick: () => setNetwork('devnet') }, 'DEVNET'),
    React.createElement('button', { id: 'probe-to-mainnet', onClick: () => setNetwork('mainnet') }, 'MAINNET')
  );
}

async function renderWallet() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(React.createElement(WalletProbe));
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

function text(id: string): string {
  return container?.querySelector(`#${id}`)?.textContent ?? '';
}

/** Endpoint of the Connection currently held by the hook. */
function endpoint(): string {
  return text('probe-endpoint');
}

/** Identity of the Connection currently held by the hook. */
function connectionId(): string {
  return text('probe-connection-id');
}

function networkState(): string {
  return text('probe-network');
}

async function selectNetwork(network: 'devnet' | 'mainnet') {
  const button = container?.querySelector(`#probe-to-${network}`) as HTMLButtonElement | null;
  if (!button) {
    throw new Error(`network switch button for ${network} not found`);
  }
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}


describe('useWallet — the Retrieve Connection follows the selected network', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelection.network = 'mainnet';
    mockSelection.created = 0;
    mockCreateConnection.mockImplementation(() => {
      mockSelection.created += 1;
      return {
        rpcEndpoint: `https://${mockSelection.network}.example/rpc`,
        id: mockSelection.created,
      };
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('mounts exactly one Connection for the persisted network', async () => {
    await renderWallet();

    expect(networkState()).toBe('mainnet');
    expect(endpoint()).toBe('https://mainnet.example/rpc');
    expect(mockCreateConnection).toHaveBeenCalledTimes(1);
  });

  it('Mainnet -> Devnet replaces the Connection (regression: stale Mainnet Connection)', async () => {
    await renderWallet();
    const mainnetConnectionId = connectionId();
    expect(endpoint()).toBe('https://mainnet.example/rpc');

    await selectNetwork('devnet');

    expect(networkState()).toBe('devnet');
    expect(endpoint()).toBe('https://devnet.example/rpc');
    // A NEW Connection object: the Mainnet one is not reused.
    expect(connectionId()).not.toBe(mainnetConnectionId);
  });

  it('Devnet -> Mainnet replaces the Connection', async () => {
    mockSelection.network = 'devnet';
    await renderWallet();
    const devnetConnectionId = connectionId();
    expect(endpoint()).toBe('https://devnet.example/rpc');

    await selectNetwork('mainnet');

    expect(networkState()).toBe('mainnet');
    expect(endpoint()).toBe('https://mainnet.example/rpc');
    expect(connectionId()).not.toBe(devnetConnectionId);
  });

  it('keeps the Connection in sync across a Mainnet -> Devnet -> Mainnet round trip', async () => {
    await renderWallet();

    await selectNetwork('devnet');
    expect(endpoint()).toBe('https://devnet.example/rpc');

    await selectNetwork('mainnet');
    expect(endpoint()).toBe('https://mainnet.example/rpc');
  });

  it('does not throw when the selected network has no usable RPC endpoint', async () => {
    mockCreateConnection.mockImplementationOnce(() => {
      throw new Error('Mainnet RPC is not configured. Set NEXT_PUBLIC_SOLANA_MAINNET_RPC.');
    });

    await renderWallet(); // must not throw out of the effect

    expect(endpoint()).toBe('');
  });
});
