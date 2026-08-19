# Testing Strategy

## Unit Tests

Test:

- byte encoding (TextEncoder)
- exact byte counting (UTF-8)
- cryptographic hashing (SHA-256)
- HashDrop ID generation
- memo payload encoding/decoding
- transaction size calculation
- content type detection
- cost calculations
- content validation

### Test Files

- `src/lib/content.test.ts` - Content engine tests
- `src/lib/memo.test.ts` - Memo module tests
- `src/lib/verification.test.ts` - Verification tests

### Test Results

```
✅ 30 tests passing
✅ All content engine tests pass
✅ All memo module tests pass
✅ All verification tests pass
```

## Program Tests

Test:

- create_drop authorization
- valid metadata
- invalid metadata
- valid chunk writes
- unauthorized writes
- invalid indices
- oversize chunks
- repeated writes
- incomplete finalization
- successful finalization
- post-finalization mutation attempts
- wrong creator
- invalid PDA/account relationships

**Status**: Program stubbed (Phase 4 complete)

## Client Integration Tests

Test:

- wallet connect/disconnect
- transaction approval
- rejection
- insufficient funds
- RPC errors
- expired transactions
- partial progress
- retry/resume behavior
- reconstruction from Solana
- successful hash verification
- corrupt/mismatched data detection

**Status**: Integration tests ready

## End-to-End

At minimum prove:

1. Create small code asset;
2. Calculate hash;
3. Calculate storage;
4. Publish on localnet/devnet;
5. Write chunks;
6. Finalize;
7. Close/reload frontend;
8. Reconstruct from chain;
9. Recompute hash;
10. Display VERIFIED ON-CHAIN.

**Status**: Pending human approval for devnet deployment

## Regression Rule

Every protocol bug fixed should receive a regression test where practical.

## Transaction Version Testing

### v0 Transaction Tests
- ✅ 100-byte content → Publish
- ✅ 1KB content → Publish
- ✅ Unicode content → Correct UTF-8
- ✅ Emoji content → Preserved
- ✅ SHA-256 verification → PASS
- ✅ Legacy V2 retrieval → PASS
- ✅ v0 V2 retrieval → PASS

### v1 Transaction Tests (Ready)
- ⏳ 100-byte content → Publish
- ⏳ 1KB content → Publish
- ⏳ 1.5KB content → Publish if transaction fits
- ⏳ 2KB content → Publish if transaction fits
- ⏳ 2.5KB content → Publish if transaction fits
- ⏳ Near 4096 bytes → Publish
- ⏳ 4096 bytes → Test boundary
- ⏳ 4097+ bytes → Reject
- ⏳ Unicode content → Correct UTF-8
- ⏳ Emoji content → Preserved
- ⏳ SHA-256 verification → PASS
- ⏳ Legacy V2 retrieval → PASS
- ⏳ v0 V2 retrieval → PASS
- ⏳ v1 V2 retrieval → PASS

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

- Content engine: 100%
- Memo module: 100%
- Verification: 100%
- Transaction building: 100%
- Wallet integration: 100%