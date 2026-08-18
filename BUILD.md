# Build Instructions for Cline

## Objective

Build HashDrop phase by phase. Do not attempt the entire protocol in one pass.

## First implementation task

Create the application skeleton and static UI for Phase 1.

The first implementation must NOT:

- deploy a Solana program;
- write to mainnet;
- introduce a backend database;
- introduce IPFS as canonical storage;
- claim blockchain success.

## Phase 1 UI requirements

Implement:

- HashDrop brand shell
- black/white/red visual system
- create/drop editor
- content size placeholder/preview
- hash placeholder area
- cost summary placeholder
- wallet connect placeholder
- publish flow placeholder
- viewer mock
- responsive desktop/mobile layout

The UI should be structured so later blockchain modules can replace mocks without rewriting the entire application.

## Next task after Phase 1

Implement the local content engine and replace placeholders with real browser calculations.

Do not proceed to the Solana program until the human owner approves the next phase.
