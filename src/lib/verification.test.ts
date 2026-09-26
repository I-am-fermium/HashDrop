/**
 * Tests for HashDrop Verification Module (V3 only)
 */

import { verifyPublicDrop, verifyBySignature } from './verification';
import { createDevnetConnection } from './rpc/devnet';

// Live Devnet connection for these integration-style tests: it uses the SAME
// configured Devnet RPC as the application (NEXT_PUBLIC_SOLANA_DEVNET_RPC when
// set, public Devnet otherwise) instead of hard-coding a public endpoint that
// may not serve getTransaction at all.
const createMockConnection = () => {
  return createDevnetConnection();
};

describe('Verification Module', () => {
  describe('verifyPublicDrop', () => {
    it('should return error for non-existent transaction', async () => {
      const connection = createMockConnection();

      // This negative test INTENTIONALLY passes an invalid signature, so the
      // RPC answers -32602 "Invalid param: Invalid" and verifyPublicDrop logs
      // the expected error via console.error. Suppress ONLY this expected
      // output (scoped to this test); assertions below are unchanged.
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let result: Awaited<ReturnType<typeof verifyPublicDrop>>;
      let errorPathExercised = false;
      try {
        result = await verifyPublicDrop(connection, 'nonexistent12345678901234567890123456789012345678901234567890123456789012345678901234');
        // Captured before mockRestore() clears the recorded calls.
        errorPathExercised = consoleErrorSpy.mock.calls.length > 0;
      } finally {
        consoleErrorSpy.mockRestore();
      }

      // The expected error path was still exercised (logged, now hidden).
      expect(errorPathExercised).toBe(true);

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

      // Same intentionally-invalid signature as above: the resulting
      // console.error is expected output, suppressed only for this test.
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      let result: Awaited<ReturnType<typeof verifyBySignature>>;
      let errorPathExercised = false;
      try {
        result = await verifyBySignature(connection, signature);
        // Captured before mockRestore() clears the recorded calls.
        errorPathExercised = consoleErrorSpy.mock.calls.length > 0;
      } finally {
        consoleErrorSpy.mockRestore();
      }
      expect(errorPathExercised).toBe(true);

      expect(result.verified).toBe(false);
    }, 30000);
  });
});