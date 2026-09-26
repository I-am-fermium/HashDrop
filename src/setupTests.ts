// Jest setup file
// Add any necessary global mocks or setup here

/**
 * Load the project's .env files the same way the Next.js runtime does
 * (highest precedence first, never overriding variables already present in the
 * environment). This lets integration tests use the SAME configured RPC
 * endpoints as the running application (NEXT_PUBLIC_SOLANA_DEVNET_RPC /
 * NEXT_PUBLIC_SOLANA_MAINNET_RPC) instead of hard-coded public endpoints.
 * Missing files are skipped silently (CI without .env.local still runs).
 */
function loadEnvFilesForTests(): void {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  for (const file of ['.env.local', '.env']) {
    try {
      const contents = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator <= 0) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch {
      // File absent (e.g. CI): the documented defaults apply.
    }
  }
}

loadEnvFilesForTests();

/**
 * jsdom (the jest test environment) implements no fetch at all, so RPC reads
 * would use a transport that cannot honour an AbortSignal. Install node-fetch
 * (already present via @solana/web3.js) so tests exercise the same request path
 * as the browser and Node runtime. Test-only — the application never
 * polyfills fetch.
 */
if (typeof (globalThis as { fetch?: unknown }).fetch === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    (globalThis as { fetch?: unknown }).fetch =
      typeof nodeFetch === 'function' ? nodeFetch : nodeFetch.default;
  } catch {
    // No polyfill available: the bounded read still guarantees a terminal
    // state through its race-based fallback.
  }
}

import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill for atob (browser API not available in Node.js)
if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (str: string): string => {
    return Buffer.from(str, 'base64').toString('binary');
  };
}

// Mock crypto for Node.js test environment
const cryptoMock = {
  subtle: {
    digest: async (algorithm: string, data: ArrayBuffer) => {
      if (algorithm === 'SHA-256') {
        // Simple SHA-256 mock - return deterministic hash based on input
        const input = new Uint8Array(data);
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
          hash = ((hash << 5) - hash + input[i]) & 0xffffffff;
        }
        
        // Generate mock hash bytes
        const hashBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hashBytes[i] = ((hash + i * 17) & 0xff);
        }
        return hashBytes.buffer;
      }
      throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }
};

// Add crypto to globalThis if not present (Node.js doesn't have it by default)
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = cryptoMock;
}