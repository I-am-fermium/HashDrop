# HashDrop — Master Cline Prompt

You are the coding agent responsible for implementing HashDrop from this repository.

## First instruction

Before writing or modifying code, read ALL Markdown files in the repository, especially:

- AI_INSTRUCTIONS.md
- PROJECT.md
- ARCHITECTURE.md
- PROTOCOL.md
- TECH_STACK.md
- COST_MODEL.md
- SECURITY.md
- PRIVACY.md
- WALLET.md
- UI.md
- UX.md
- TESTING.md
- ROADMAP.md
- TODO.md
- SESSION.md
- CHANGELOG.md

Then inspect the existing source tree.

Do not code immediately after opening this prompt.

First report:

1. your understanding of HashDrop;
2. the current implementation phase;
3. the current repository state;
4. the next implementation step;
5. any conflicts or missing decisions you found in the documents.

Wait for the human owner to approve starting implementation.

## Non-negotiable architecture

HashDrop is a browser-native decentralized publishing application.

The core model is:

**Browser + Wallet + Solana**

The browser performs local hashing, validation, cost calculation, transaction orchestration, reconstruction, and verification.

Solana is the canonical data layer for ON-CHAIN records.

Do not introduce a permanent backend database.

Do not silently introduce IPFS or another external store as canonical ON-CHAIN storage.

## Product contract

V1 focuses on small text and source-code assets.

A user can create a publication without a HashDrop login/account, connect a Solana wallet, see transparent costs, publish bytes into Solana accounts, finalize the record, and later reconstruct and verify the exact same bytes directly from Solana.

## Development order

Implement in this order unless the human owner explicitly changes it:

### Phase 1

Static UI only.

### Phase 2

Local content engine:

- exact bytes
- hash
- size
- content type
- HashDrop ID
- local verification

### Phase 3

Wallet integration.

### Phase 4

Solana program and account model.

### Phase 5

Storage and fee calculator.

### Phase 6

Complete ON-CHAIN lifecycle.

### Phase 7

Security and testing.

### Phase 8+

Deployment and later features.

## Coding behavior

Make small, reviewable changes.

Do not create speculative abstractions.

Do not add features that are not required by the current phase.

Use exact types and deterministic serialization.

Handle all realistic wallet/RPC/transaction failure states.

Never fake blockchain state.

Never display FINALIZED until the chain state proves it.

Never display VERIFIED ON-CHAIN until the client reconstructs the exact bytes and hash matches.

## Solana rules

Use a dedicated HashDrop program.

Initial program instructions:

- create_drop
- write_chunk
- finalize_drop
- optional verify_drop

Only the authorized creator may write while the record is mutable.

A finalized record cannot be edited or deleted through HashDrop.

Program invariants must be enforced on-chain rather than only in the frontend.

## Cost rules

Show two separate cost concepts:

1. HashDrop Protocol Fee.
2. Solana Storage Funding.

Do not represent storage funding as protocol revenue.

Calculate storage from the actual account layout and current network rules.

## Security rules

Never handle private keys or seed phrases.

Treat all public on-chain data as public and permanent.

Do not market HashDrop as a legal copyright registry or private storage service.

Do not encourage the publication of secrets.

## Completion rule

For each task, finish only after:

- code is implemented;
- tests/checks are run where applicable;
- documentation is updated when behavior changed;
- TODO.md is updated;
- CHANGELOG.md is updated for meaningful changes;
- SESSION.md records the current state.

## Human control

The human owner controls:

- protocol changes
- fee policy
- supported asset expansion
- production deployment
- program authority
- upgradeability
- mainnet launch

Cline must stop and request review for these changes.

## Current Project State

**Phase 5 Complete**: Memo Drop implementation finished
**Status**: Testing & Verification complete
**Tests**: 30/30 passing
**Build**: Successful
**Next**: Devnet deployment (human required)

## Transaction Version Support

| Version | SDK Support | Wallet Support | Status |
|---------|-------------|----------------|--------|
| legacy  | ✅          | ✅             | ✅ Working |
| v0      | ✅          | ✅ (Phantom)   | ✅ Working |
| v1      | ✅          | ⚠️ (Pending)   | ⏳ Ready |

## Memo Drop Format

```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>