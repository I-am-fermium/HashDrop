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

**Phase 5 - Testing & Verification Complete**

Next: Devnet deployment (human required)

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