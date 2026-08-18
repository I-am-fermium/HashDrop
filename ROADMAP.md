# Roadmap

## Phase 0 — Specification

- Freeze product definition.
- Define protocol/account model.
- Define fee model.
- Define UI system.
- Define security assumptions.

## Phase 1 — Static UI

- Create Next.js/React/TypeScript app.
- Implement black/white/red design.
- Build editor/drop screen.
- Build viewer mock.
- No blockchain yet.

## Phase 2 — Local Content Engine

- Browser byte counting.
- Cryptographic hashing.
- Content-type detection.
- HashDrop ID generation.
- Local verification.

## Phase 3 — Wallet

- Wallet Standard-compatible flow.
- Connect/disconnect.
- Network selection.
- Transaction approval UI.
- Error states.

## Phase 4 — Solana Program

- Program scaffold.
- Metadata PDA.
- Data/chunk accounts.
- create_drop.
- write_chunk.
- finalize_drop.

## Phase 5 — Storage Economics

- Calculate account storage.
- Estimate funding.
- Calculate protocol fee.
- Show transparent total.

## Phase 6 — End-to-End ON-CHAIN Drop

- Create account.
- Write chunks.
- Finalize.
- Reconstruct from chain.
- Verify hash.
- Display immutable status.

## Phase 7 — Security & Testing

- Unit tests.
- Program tests.
- Client tests.
- Malformed input tests.
- Partial transaction recovery.
- Wallet rejection handling.
- Replay/idempotency analysis.

## Phase 8 — Mainnet Readiness

- Program deployment plan.
- Treasury configuration.
- Fee configuration.
- Domain/deployment.
- Monitoring.
- Documentation.

## Phase 9 — Launch

- Public beta.
- Usage limits.
- Bug reporting.
- Protocol transparency.
- Community feedback.

## Phase 10 — Future

- Indexer/cache.
- Search.
- Larger asset modes.
- HASH-ANCHORED mode.
- Versioning.
- SDK/CLI.
