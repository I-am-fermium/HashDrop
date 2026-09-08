'use client';

import { useSyncExternalStore } from 'react';
import { Network, getCurrentNetwork, setCurrentNetwork, isMainnet } from '../lib/network';

interface NetworkSelectorProps {
  currentNetwork: Network;
  onNetworkChange: (network: Network) => void;
}

export function NetworkSelector({ currentNetwork, onNetworkChange }: NetworkSelectorProps) {
  // Hydration marker without setState-in-effect: false during SSR and the
  // hydration render, true afterwards (canonical useSyncExternalStore pattern).
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const handleNetworkChange = (network: Network) => {
    if (network !== currentNetwork) {
      setCurrentNetwork(network);
      onNetworkChange(network);
    }
  };

  if (!isClient) {
    return (
      <div className="flex gap-2">
        <button
          disabled
          className="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm cursor-not-allowed"
        >
          DEVNET
        </button>
        <button
          disabled
          className="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm cursor-not-allowed"
        >
          MAINNET
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleNetworkChange('devnet')}
        className={`px-3 py-1 rounded text-sm font-medium transition ${
          currentNetwork === 'devnet'
            ? 'bg-accent text-white'
            : 'bg-gray-700 text-secondary hover:bg-gray-600'
        }`}
      >
        DEVNET
      </button>
      <button
        onClick={() => handleNetworkChange('mainnet')}
        className={`px-3 py-1 rounded text-sm font-medium transition ${
          currentNetwork === 'mainnet'
            ? 'bg-accent text-white'
            : 'bg-gray-700 text-secondary hover:bg-gray-600'
        }`}
      >
        MAINNET
      </button>
    </div>
  );
}

export default NetworkSelector;