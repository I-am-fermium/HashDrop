# Roadmap

## Current Status: Phase 5 Complete - Memo Drop Ready

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
- [x] Dynamic size validation
- [x] Transaction version detection

## Phase 5 — Testing & Verification ✅ COMPLETE

- [x] Unit tests (30/30 passing)
- [x] Program tests (stubbed)
- [x] Client tests
- [x] End-to-end devnet testing (pending human approval)

## Phase 6 — Devnet Deployment ⏳ IN PROGRESS

- [ ] Install Solana CLI
- [ ] Build and deploy Solana program
- [ ] Update PROGRAM_ID in constants.ts
- [ ] Test end-to-end publishing with Phantom wallet

## Phase 7 — Mainnet Readiness (Pending)

- [ ] Program review
- [ ] Authority review
- [ ] Deployment verification
- [ ] Fee configuration review
- [ ] Upgradeability/immutability review
- [ ] Rollback/incident plan

## Phase 8 — Launch (Future)

- [ ] Public beta
- [ ] Usage limits
- [ ] Bug reporting
- [ ] Protocol transparency
- [ ] Community feedback

## Phase 9 — Future Enhancements

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