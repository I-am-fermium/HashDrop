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
2. Solana Network Fee.

Do not represent network fees as protocol revenue.

Calculate fees from the actual transaction configuration and current network rules.

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

**Phase 6 Complete**: RPC Migration to Solana Kit finished
**Status**: Memo Drop implementation complete, testing complete
**Platform Fee**: Real on-chain `SystemProgram.transfer` (0.001 SOL → `HASHDROP_FEE_WALLET`) included in every publish transaction
**Tests**: 44/44 passing
**Build**: Successful
**Next**: Devnet deployment (human required), Mainnet testing (requires RPC URL)

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

## Transaction Version Support

| Version | SDK Support | Wallet Support | Status |
|---------|-------------|----------------|--------|
| legacy  | ✅          | ✅             | ✅ Working |
| v0      | ✅          | ✅ (Phantom)   | ✅ Working |
| v1      | ✅          | ⚠️ (Pending)   | ⏳ Ready |

## Memo Drop Format

```
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>