# Project Contract

## Product

HashDrop is a decentralized on-chain content publishing application.

## Product promise

A user can publish a small text/code asset, pay transparent storage and protocol costs, finalize it, and later reconstruct and verify the exact same bytes directly from Solana.

## What HashDrop does not require

- User accounts
- Passwords
- Email login
- Permanent centralized content database
- Permanent centralized canonical asset copy
- IPFS as canonical storage for ON-CHAIN records

## Product identity

Positioning:

> Drop it. Hash it. Own it.

HashDrop is a cryptographically verifiable publication/provenance system. It must not claim to be a legal copyright registry.

## V1 asset scope

Supported initially:

- Plain text
- Source code

Examples may include JavaScript, TypeScript, HTML, CSS, JSON, Markdown, Python, Rust, Solidity, and other text-based source formats if the implementation defines them safely.

The implementation must define supported types explicitly instead of accepting every file blindly.

## V1 constraints

- Browser-first.
- Static frontend.
- Solana canonical storage.
- Small assets only.
- Conservative maximum size.
- Exact byte counting.
- Local cryptographic hashing.
- Transparent cost estimate before signing.
- Multi-transaction publication must be resumable.
- Finalized records are immutable.

## Future scope

- Larger assets.
- HASH-ANCHORED mode.
- Search/indexer cache.
- Versioning.
- SDK.
- CLI.
- Independent explorers and third-party clients.

Future features must not silently change the V1 contract.
