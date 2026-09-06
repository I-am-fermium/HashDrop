# Roadmap

## Current Status: Phase 6 Complete - RPC Migration Finished

## Phase 0 — Specification ✅ COMPLETE

- [x] Freeze product definition
- [x] Define protocol/account model
- [x] Define fee model
- [x] Define UI system
- [x] Define security assumptions

## Phase 1 — Static UI ✅ COMPLETE

- [x] Create Next.js/React/TypeScript app
- [x] Implement black/white/red design
- [x] Build editor/drop screen
- [x] Build viewer mock
- [x] No blockchain yet

## Phase 2 — Local Content Engine ✅ COMPLETE

- [x] Browser byte counting
- [x] Cryptographic hashing
- [x] Content-type detection
- [x] HashDrop ID generation
- [x] Local verification

## Phase 3 — Wallet ✅ COMPLETE

- [x] Wallet Standard-compatible flow
- [x] Connect/disconnect
- [x] Network selection
- [x] Transaction approval UI
- [x] Error states

## Phase 4 — Memo Drop ✅ COMPLETE

- [x] SPL Memo program integration
- [x] V2 memo payload format
- [x] Transaction building (v0 format)
- [x] Platform fee transfer (0.001 SOL → HashDrop fee wallet via `SystemProgram.transfer`)
- [x] Dynamic size validation
- [x] Transaction version detection

## Phase 5 — Testing & Verification ✅ COMPLETE

- [x] Unit tests (44/44 passing)
- [x] Program tests (stubbed)
- [x] Client tests
- [x] End-to-end devnet testing (pending human approval)

## Phase 6 — RPC Migration ✅ COMPLETE

- [x] Solana Kit as primary RPC layer
- [x] RPC factory pattern with `createRpc()` and `createConnection()`
- [x] Network-specific RPC configuration
- [x] Updated `transactions.ts` to use Solana Kit RPC
- [x] Updated `page.tsx` to use Solana Kit RPC
- [x] Fixed hydration mismatch in network state
- [x] Fixed Mainnet RPC 403 error

## Phase 7 — Devnet Deployment ⏳ IN PROGRESS

- [ ] Install Solana CLI
- [ ] Build and deploy Solana program
- [ ] Update PROGRAM_ID in constants.ts
- [ ] Test end-to-end publishing with Phantom wallet

## Phase 8 — Mainnet Readiness (Pending)

- [ ] Program review
- [ ] Authority review
- [ ] Deployment verification
- [ ] Fee configuration review
- [ ] Upgradeability/immutability review
- [ ] Rollback/incident plan

## Phase 9 — Launch (Future)

- [ ] Public beta
- [ ] Usage limits
- [ ] Bug reporting
- [ ] Protocol transparency
- [ ] Community feedback

## Phase 10 — Future Enhancements

- [ ] Indexer/cache
- [ ] Search
- [ ] Larger asset modes
- [ ] HASH-ANCHORED mode
- [ ] Versioning
- [ ] SDK/CLI

---

## Solana v1 Transaction Status

### Current State
- **SDK Support**: ✅ Available (web3.js 1.98.4, Kit 7.1.1)
- **Wallet Support**: ⚠️ Phantom does NOT fully support v1 transaction signing
- **Network Support**: ✅ Devnet supports v1 transactions

### Implementation
- Currently using **v0 transactions** (1232-byte limit)
- Ready to switch to **v1 transactions** (4096-byte limit) when Phantom adds support
- Retrieval already supports v1 transactions

### Next Steps for v1
1. Monitor Phantom wallet for v1 transaction signing support
2. Update transaction builder to use `compileToV1Message()`
3. Test on Devnet with actual v1 transactions
4. Update UI to display v1 transaction info

---

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

---

## Transaction Version Support

| Version | Max Size | Effective Content | Wallet Support |
|---------|----------|-------------------|----------------|
| legacy  | 1232 B   | ~800 B (base64)   | ✅ Working |
| v0      | 1232 B   | ~800 B (base64)   | ✅ Phantom |
| v1      | 4096 B   | ~2800 B (base64)  | ⚠️ Pending |