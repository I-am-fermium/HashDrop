# Changelog

All notable project changes are recorded here.

## Unreleased

### Added

- Initial HashDrop product and protocol documentation (already present).
- Initial AI-assisted development rules (already present).
- Initial roadmap and MVP definition (already present).

## Phase 0 - Foundation (2026-08-12)

### Added

- Next.js 14 project structure with React 18 and TypeScript
- Content engine with:
  - SHA-256 hashing using Web Crypto API
  - Content type detection (JavaScript, TypeScript, HTML, CSS, JSON, Markdown)
  - HashDrop ID generation algorithm
  - Byte encoding and counting utilities
- Tailwind CSS configuration with black/white/red design system
- Solana transaction helper utilities:
  - Chunk counting and storage funding calculation
  - PDA generation for metadata and chunk accounts
  - Transaction instructions for create, write, and finalize operations
- Jest testing configuration
- Content engine unit tests

### Changed

- Updated TODO.md to reflect completed Phase 0 tasks

### Technical Notes

- V1 supported content types: Plain text, JavaScript, TypeScript, HTML, CSS, JSON, Markdown
- Maximum asset size: 10KB for V1
- Chunk size: 890 bytes (based on Solana constraints)
- HashDrop ID format: `hd_{hash_prefix}_{creator_short}_{size_hash}`

### Tests Performed

- Content engine unit tests for stringify, hashing, content type detection, and HashDrop ID generation

### Limitations

- Phase 1 UI is static with placeholders for blockchain features
- Solana program needs to be developed in Phase 4
- Wallet integration needs to be implemented in Phase 3