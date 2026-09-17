'use client';

// Use address string instead of PublicKey for Kit compatibility
type Address = string;

interface WalletConnectProps {
  isConnected: boolean;
  publicKey: Address | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function WalletConnect({ isConnected, publicKey, onConnect, onDisconnect }: WalletConnectProps) {
  const handleConnect = async () => {
    await onConnect();
  };

  const handleDisconnect = async () => {
    await onDisconnect();
  };

  return (
    <div className="flex flex-col gap-3">
      {isConnected && publicKey ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-secondary">
            Connected as: <span className="font-mono text-xs text-accent">{publicKey.slice(0, 4)}...{publicKey.slice(-4)}</span>
          </div>
<button
            onClick={handleDisconnect}
            className="bg-accent text-white font-bold py-1 px-3 rounded hover:opacity-90 transition text-sm"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="w-full bg-accent text-white font-bold py-2 px-4 rounded hover:opacity-90 transition"
        >
          Connect Wallet
        </button>
      )}
      <p className="text-xs text-secondary">
        Connect your Solana wallet to publish content on-chain
      </p>
    </div>
  );
}

export default WalletConnect;