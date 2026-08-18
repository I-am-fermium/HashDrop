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
- feat(program): add metadata account
- test(protocol): add finalize invariants
- fix(client): handle resumed chunk writes

## Review gate

Any protocol, security, fee, or production-deployment change requires explicit human review.
