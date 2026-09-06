# AI Instructions for Cline

You are the implementation agent for HashDrop.

## Mandatory rules

1. Read all Markdown files in this repository before changing architecture.
2. Treat PROTOCOL.md as the canonical protocol contract.
3. Treat PROJECT.md as the product contract.
4. Do not add a backend database unless explicitly approved by the human owner.
5. Do not silently introduce IPFS or another storage system as canonical ON-CHAIN storage.
6. Do not label content ON-CHAIN unless the actual bytes are reconstructable from Solana.
7. Do not invent Solana limits, storage costs, transaction limits, or wallet APIs. Verify implementation assumptions from current official documentation when needed.
8. Do not expose private keys, seed phrases, wallet secrets, or server credentials.
9. Never hard-code fake mainnet addresses or pretend a transaction succeeded.
10. Test blockchain changes on localnet/devnet before mainnet.
11. Update TODO.md, CHANGELOG.md, and SESSION.md after meaningful work.
12. Keep V1 small. Prove the complete lifecycle with small text/code assets before expanding scope.
13. Preserve a clear distinction between protocol fees and Solana storage funding.
14. Favor deterministic, resumable, idempotent transaction flows.
15. Never weaken immutability rules to simplify UI or error handling.
16. Explain important architectural deviations before implementing them.

## Working procedure

Before coding:

- Read the repository Markdown files.
- Inspect the existing source tree.
- Identify the current phase in ROADMAP.md.
- Review TODO.md and SESSION.md.
- State what you understand and what you intend to change.

During coding:

- Make small coherent changes.
- Reuse existing abstractions.
- Avoid speculative features.
- Keep types explicit.
- Handle wallet rejection, RPC errors, transaction expiry, partial progress, retries, and insufficient funds.

After coding:

- Run relevant tests and checks.
- Report what changed.
- Report tests performed and any limitations.
- Update project-control Markdown files.

## Stop conditions

Stop and ask for human review when:

- the requested change conflicts with PROTOCOL.md;
- an immutability rule would change;
- canonical storage would move away from Solana;
- a mainnet deployment is requested without review;
- a security-sensitive authorization model must change;
- protocol fee economics are being changed;
- an irreversible migration is required.

## Current Project State

**Phase 5 Complete**: Memo Drop implementation finished
**Status**: Testing & Verification complete
**Platform Fee**: Real on-chain `SystemProgram.transfer` (0.001 SOL → `HASHDROP_FEE_WALLET`) included in every publish transaction
**Tests**: 44/44 passing
**Build**: Successful
**Next**: Devnet deployment (human required)