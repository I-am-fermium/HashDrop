/**
 * Tests for HashDrop Verification Module (V3 only)
 */

import { verifyPublicDrop, verifyBySignature, PublicVerificationResult } from './verification';
import { Connection } from '@solana/web3.js';

// Mock connection for unit tests
const createMockConnection = () => {
  return new Connection('https://api.devnet.solana.com', 'confirmed');
};

describe('Verification Module', () => {
  describe('verifyPublicDrop', () => {
    it('should return error for non-existent transaction', async () => {
      const connection = createMockConnection();

      const result = await verifyPublicDrop(connection, 'nonexistent12345678901234567890123456789012345678901234567890123456789012345678901234');

      expect(result.verified).toBe(false);
      // getTransaction throws an error for invalid signatures, which is caught
      // The error message should contain information about the RPC failure
      expect(result.error).toBeDefined();
      expect(result.error).not.toBeNull();
    }, 30000);

    it('should reject V2 payload (no longer supported)', async () => {
      const connection = createMockConnection();

      // This is a known V2 transaction - it should no longer be verifiable
      const signature = '5QSigbpsA4siqaTpGza3Q4kMFrwSzUKXn5TSkzJFyLxy8EdARYgwhFaMw69cGD3x1DruTZt2GweRB65c3GXCsyYg';

      const result = await verifyPublicDrop(connection, signature);

      // V2 transactions should fail verification since V2 is no longer supported
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Invalid HashDrop payload');
    }, 30000);
  });

  describe('verifyBySignature', () => {
    it('should be an alias for verifyPublicDrop', async () => {
      const connection = createMockConnection();

      const signature = 'nonexistent12345678901234567890123456789012345678901234567890123456789012345678901234';

      const result = await verifyBySignature(connection, signature);

      expect(result.verified).toBe(false);
    }, 30000);
  });
});