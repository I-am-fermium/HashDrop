# Technology Stack

## Frontend

Target:

- Next.js
- React
- TypeScript
- modern browser APIs

The frontend should be deployable as a static web application whenever practical.

## Blockchain

- Solana
- Solana wallet standards / compatible wallet integration
- A dedicated HashDrop on-chain program

The exact Solana program framework and libraries may be selected during implementation, but the choice must be documented and justified.

## Browser capabilities

Use native browser capabilities for:

- hashing
- byte encoding
- local validation
- content handling
- progress and state management

Use Web Crypto where appropriate and avoid unnecessary server-side crypto.

## Testing

Use a test stack appropriate to the selected framework for:

- pure TypeScript utilities
- content hashing
- serialization
- protocol client logic
- UI state
- program instructions
- end-to-end devnet/localnet flows

## Dependency rule

Prefer small, well-maintained dependencies. Do not add a library merely to solve a problem already handled reliably by the browser or the chosen Solana stack.
