/**
 * Tests for HashDrop Verification Module
 */

import { verifyMemoDrop, verifyBySignature, MemoVerificationResult } from './verification';
import { Connection } from '@solana/web3.js';

// Mock connection for unit tests
const createMockConnection = () => {
  return new Connection('https://api.devnet.solana.com', 'confirmed');
};

describe('Verification Module', () => {
  describe('verifyMemoDrop', () => {
    it('should verify the known-good transaction', async () => {
      const connection = createMockConnection();
      
      // Known-good transaction from the task
      const signature = '5QSigbpsA4siqaTpGza3Q4kMFrwSzUKXn5TSkzJFyLxy8EdARYgwhFaMw69cGD3x1DruTZt2GweRB65c3GXCsyYg';
      
      const result = await verifyMemoDrop(connection, signature);
      
      console.log('[TEST] Verification result:', JSON.stringify(result, null, 2));
      
      expect(result.verified).toBe(true);
      expect(result.content).toBe('Hello, HashDrop!');
      expect(result.hashDropId).toBe('hd_e0ba1ac4_Amy4Tej8_g');
      expect(result.contentHash).toBe('e0ba1ac4b690b9dbd655be81caf5cebec06f2644681c4cf6ff774bec72c683e3');
      expect(result.contentType).toBe('text/plain');
      expect(result.contentSize).toBe(16);
      expect(result.version).toBe('v2');
      expect(result.type).toBe('MEMO');
      expect(result.error).toBeNull();
    }, 30000);

    it('should return error for non-existent transaction', async () => {
      const connection = createMockConnection();
      
      const result = await verifyMemoDrop(connection, 'nonexistent12345678901234567890123456789012345678901234567890123456789012345678901234');
      
      expect(result.verified).toBe(false);
      // getTransaction throws an error for invalid signatures, which is caught
      // The error message should contain information about the RPC failure
      expect(result.error).toBeDefined();
      expect(result.error).not.toBeNull();
      expect(result.error).toContain('failed to get transaction');
    }, 30000);

    it('should verify the second known-good transaction (V0)', async () => {
      const connection = createMockConnection();
      
      // Second known-good transaction from the task
      const signature = '3jfqd6z2L3tV88WU7KrM7D6TroGykjVKq7ATXnvZjxv6oNih4AyxyCjy9Msm1eksyuePooZd9BJkRSXBaRyfjHnn';
      
      const result = await verifyMemoDrop(connection, signature, 'hd_e0ba1ac4_Amy4Tej8_g');
      
      console.log('[TEST 2] Verification result:', JSON.stringify(result, null, 2));
      
      expect(result.verified).toBe(true);
      expect(result.content).toBe('Hello, HashDrop!');
      expect(result.hashDropId).toBe('hd_e0ba1ac4_Amy4Tej8_g');
      expect(result.contentHash).toBe('e0ba1ac4b690b9dbd655be81caf5cebec06f2644681c4cf6ff774bec72c683e3');
      expect(result.contentType).toBe('text/plain');
      expect(result.contentSize).toBe(16);
      expect(result.version).toBe('v2');
      expect(result.type).toBe('MEMO');
      expect(result.error).toBeNull();
    }, 30000);
  });

  describe('verifyBySignature', () => {
    it('should be an alias for verifyMemoDrop', async () => {
      const connection = createMockConnection();
      
      const signature = '5QSigbpsA4siqaTpGza3Q4kMFrwSzUKXn5TSkzJFyLxy8EdARYgwhFaMw69cGD3x1DruTZt2GweRB65c3GXCsyYg';
      
      const result = await verifyBySignature(connection, signature);
      
      expect(result.verified).toBe(true);
      expect(result.content).toBe('Hello, HashDrop!');
    }, 30000);
  });
});