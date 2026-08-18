// Jest setup file
// Add any necessary global mocks or setup here

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