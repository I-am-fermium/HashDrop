# Development Workflow

## Every Cline session

1. Read Markdown instructions.
2. Inspect current git/source state.
3. Read SESSION.md and TODO.md.
4. Identify the current roadmap phase.
5. Implement only the requested phase/task.
6. Run tests/checks.
7. Update TODO, CHANGELOG, SESSION.

## Commit quality

Prefer small commits with a single purpose.

Examples:

- feat(ui): add create-drop editor
- feat(core): add browser content hashing
- feat(program): add metadata PDA
- test(protocol): add finalize invariants
- fix(client): handle resumed chunk writes

## Review gate

Any protocol, security, fee, or production-deployment change requires explicit human review.

## Current Phase

**Phase 6 - RPC Migration Complete**

Next: Devnet deployment (human required), Mainnet testing (requires RPC URL)

## Testing Workflow

1. Run `npm test` before each commit
2. Run `npm run build` to verify compilation
3. Run `npx tsc --noEmit` to verify types
4. Run `npm run lint` to verify linting

## Documentation Updates

After completing a phase:

1. Update CHANGELOG.md with phase summary
2. Update ROADMAP.md with phase status
3. Update ARCHITECTURE.md if architecture changed
4. Update TECH_STACK.md if dependencies changed
5. Update SESSION.md with current state
6. Update TASK_PROGRESS.md with completed tasks

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

## Environment Configuration

For Mainnet deployment, create a `.env.local` file:

```bash
# Mainnet RPC URL (REQUIRED for Mainnet)
NEXT_PUBLIC_SOLANA_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# Devnet RPC URL (optional, defaults to Solana Devnet)
NEXT_PUBLIC_SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

**Important:** The application will NOT fall back to the public Solana Mainnet RPC if `NEXT_PUBLIC_SOLANA_MAINNET_RPC` is not configured. You must provide a valid RPC endpoint.