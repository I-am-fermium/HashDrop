'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { verifyBySignature, MemoVerificationResult } from '../../lib/verification';
import { getConnection } from '../../lib/solana/networkCost';
import { Network, getExplorerUrl, isMainnet } from '../../lib/network';

export default function Viewer() {
  const [hashDropId, setHashDropId] = useState('');
  const [signature, setSignature] = useState('');
  const [status, setStatus] = useState<'START' | 'FETCHING' | 'FINDING' | 'DECODING' | 'VERIFYING' | 'VERIFIED' | 'FAILED'>('START');
  const [result, setResult] = useState<MemoVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetworkState] = useState<Network>('devnet');

  const { publicKey, isConnected, connection } = useWallet();

  // Sync network state from wallet hook
  useEffect(() => {
    // Get network from wallet hook
    const updateNetwork = () => {
      const { getCurrentNetwork } = require('../../lib/network');
      setNetworkState(getCurrentNetwork());
    };
    updateNetwork();
    
    // Listen for storage changes (network selector updates)
    const handleStorageChange = () => {
      updateNetwork();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleVerify = useCallback(async () => {
    let sig = signature;
    
    if (!sig) {
      setError('Please enter a transaction signature');
      return;
    }

    // Validate signature format (Base58, 88+ characters for Solana tx)
    if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(sig) || sig.length < 88) {
      setError('Invalid transaction signature format');
      return;
    }

    setStatus('FETCHING');
    setError(null);

    try {
      const conn = connection || getConnection();
      
      // Stage 1: Fetching transaction
      setStatus('FETCHING');
      const verificationResult = await verifyBySignature(conn, sig, hashDropId || undefined);

      if (verificationResult.verified) {
        setStatus('VERIFIED');
        setResult(verificationResult);
      } else {
        setStatus('FAILED');
        setError(verificationResult.error || 'Verification failed');
      }
    } catch (err) {
      setStatus('FAILED');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [signature, hashDropId, connection]);

  const getExplorerLink = () => {
    if (!result?.signature) return null;
    return getExplorerUrl(result.signature);
  };

  // Get network display based on state
  const getNetworkDisplay = () => {
    return network === 'mainnet' ? 'Mainnet (Beta)' : 'Devnet';
  };

  return (
    <main className="flex-1 container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-accent">RETRIEVE HASHDROP</h1>
        <p className="text-secondary">
          Verify and retrieve on-chain content using HashDrop ID and transaction signature
        </p>
      </div>

      {/* Network Info */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Network</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-secondary">Current:</span>
          <span className="font-mono text-accent">{getNetworkDisplay()}</span>
          {network === 'mainnet' && (
            <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-600">
              Mainnet
            </span>
          )}
        </div>
      </section>

      {/* Retrieval Details Card */}
      <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3 text-primary">Retrieval Details</h2>
        
        {/* HashDrop ID Input */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-secondary mb-2">HashDrop ID</h3>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-black text-primary font-mono p-2 rounded focus:outline-none focus:ring-2 focus:ring-accent text-xs w-full"
              placeholder="Enter HashDrop ID (e.g., hd_b130a3a3_Amy4Tej8_b)..."
              value={hashDropId}
              onChange={(e) => setHashDropId(e.target.value)}
            />
          </div>
        </div>

        {/* Transaction Signature Input */}
        <div className="mb-2">
          <h3 className="text-sm font-medium text-secondary mb-2">Transaction Signature</h3>
          <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
            <input
              type="text"
              className="flex-1 min-w-0 bg-black text-primary font-mono p-2 rounded focus:outline-none focus:ring-2 focus:ring-accent text-xs w-full"
              placeholder="Enter transaction signature..."
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
            <button
              onClick={handleVerify}
              disabled={status === 'FETCHING' || status === 'VERIFYING' || !signature}
              className="bg-accent text-white font-bold py-2 px-4 rounded hover:opacity-90 transition disabled:opacity-50 w-full md:w-auto md:shrink-0"
            >
              {status === 'VERIFYING' ? 'Verifying...' : 'RETRIEVE'}
            </button>
          </div>
        </div>
      </section>

      {/* Loading State */}
      {status === 'FETCHING' && (
        <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-3 text-primary">Loading...</h2>
          <div className="text-sm text-secondary space-y-2">
            <div>Fetching transaction...</div>
            <div>Finding Memo...</div>
            <div>Decoding V2 payload...</div>
            <div>Verifying SHA-256...</div>
          </div>
        </section>
      )}

      {/* Verification Result */}
      {result && (
        <>
          <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
            <h2 className="text-xl font-bold text-green-400 mb-4">✅ VERIFIED</h2>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs text-secondary mb-1">HashDrop ID</div>
                <div className="font-mono text-xs text-accent break-all">{result.hashDropId}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Version</div>
                <div className="text-accent">{result.version || 'v2'}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Type</div>
                <div className="text-accent">{result.type || 'MEMO'}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Content</div>
                <div className="bg-black p-2 rounded font-mono text-xs text-accent break-all">{result.content}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">SHA-256</div>
                <div className="font-mono text-xs text-accent break-all">{result.contentHash}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">MIME Type</div>
                <div className="text-accent">{result.contentType}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Content Size</div>
                <div className="text-accent">{result.contentSize} bytes</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Transaction</div>
                <div className="font-mono text-xs text-accent break-all">{result.signature}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Network</div>
                <div className="text-accent">{getNetworkDisplay()}</div>
              </div>
              
              <div>
                <div className="text-xs text-secondary mb-1">Transaction Version</div>
                <div className="text-accent">{result.transactionVersion || 'v0'}</div>
              </div>
            </div>
          </div>
          
          {/* Explorer Link */}
          {getExplorerLink() && (
            <section className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-700">
              <h2 className="text-lg font-semibold mb-3 text-primary">Explorer</h2>
              <a 
                href={getExplorerLink()!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-accent hover:text-accent/80 transition break-all"
              >
                {getExplorerLink()!}
              </a>
            </section>
          )}
          
          {/* Verification message */}
          <div className="bg-gray-900 rounded-lg border border-accent border-opacity-30 mb-6">
            <div className="text-green-400 text-sm font-medium p-3">
              ✅ Content verified against on-chain SHA-256 hash
            </div>
          </div>
        </>
      )}

      {/* Error State */}
      {status === 'FAILED' && error && (
        <section className="bg-gray-900 rounded-lg p-4 border border-gray-700 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-primary">❌ VERIFICATION FAILED</h2>
          <p className="text-sm text-red-400">{error}</p>
        </section>
      )}
    </main>
  );
}