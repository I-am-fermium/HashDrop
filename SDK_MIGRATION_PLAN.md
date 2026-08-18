# HashDrop SDK Migration Plan

## Overview
This document outlines the migration plan for HashDrop to the latest stable versions of all dependencies and SDKs.

## Current State (Baseline)

### Core Dependencies
| Package | Current Version | Latest Version |
|---------|-----------------|----------------|
| next | 14.2.5 | 16.3.1 |
| react | 18.2.0 | 19.2.8 |
| react-dom | 18.2.0 | 19.2.8 |
| typescript | ^5.3.3 | 7.0.2 |

### Solana Dependencies
| Package | Current Version | Latest Version |
|---------|-----------------|----------------|
| @solana/web3.js | ^1.91.0 | 1.98.4 |
| @solana/wallet-adapter-base | 0.6.0 | 0.9.27 |
| @solana/wallet-adapter-react | 0.6.0 | 0.15.39 |
| @solana/wallet-adapter-react-ui | 0.6.0 | 0.9.39 |
| @solana/wallet-adapter-wallets | 0.6.0 | 0.19.38 |

### UI Dependencies
| Package | Current Version | Latest Version |
|---------|-----------------|----------------|
| tailwindcss | ^3.3.3 | 4.3.3 |
| postcss | ^8.4.31 | 8.4.31 (compatible) |
| autoprefixer | ^10.4.16 | 10.4.20 |

### Development Dependencies
| Package | Current Version | Latest Version |
|---------|-----------------|----------------|
| eslint | ^8.57.1 | 10.8.1 |
| eslint-config-next | ^13.5.11 | 16.3.1 |
| eslint-plugin-react | ^7.37.5 | 7.37.5 (compatible) |
| jest | ^29.7.0 | 30.4.2 |
| jest-environment-jsdom | ^29.7.0 | 30.4.2 |
| ts-jest | ^29.1.2 | 29.2.5 |
| @types/jest | ^30.0.0 | 30.0.0 |
| @types/node | ^20.10.0 | 22.10.0 |
| @types/react | ^18.2.31 | 19.2.8 |
| @types/react-dom | ^18.2.14 | 19.2.8 |

## Migration Path

### Phase 1: Solana Ecosystem Migration
**Target Versions:**
- @solana/web3.js: 1.98.4
- @solana/wallet-adapter-base: 0.9.27
- @solana/wallet-adapter-react: 0.15.39
- @solana/wallet-adapter-react-ui: 0.9.39
- @solana/wallet-adapter-wallets: 0.19.38

**Breaking Changes:**
- Wallet adapter API changes (autoConnect, wallet state handling)
- Transaction signing API changes
- PublicKey API changes

### Phase 2: Next.js Migration (14 → 15 → 16)
**Target Version:** 16.3.1

**Breaking Changes:**
- React 19 compatibility
- App Router changes
- ESLint integration changes
- TypeScript strictness

### Phase 3: React Migration
**Target Version:** 19.2.8

**Breaking Changes:**
- React Server Components
- Client component annotations
- Hook behavior changes

### Phase 4: Tailwind CSS Migration
**Target Version:** 4.3.3

**Breaking Changes:**
- CSS import changes
- Configuration format changes
- JIT engine changes

### Phase 5: TypeScript Migration
**Target Version:** 7.0.2

**Breaking Changes:**
- Strict mode changes
- Type inference changes

### Phase 6: ESLint Migration
**Target Version:** 10.8.1

**Breaking Changes:**
- Configuration format changes
- Rule names changes

### Phase 7: Jest Migration
**Target Version:** 30.4.2

**Breaking Changes:**
- Configuration format changes
- Mocking API changes

## Compatibility Matrix

| Package | React 18 | React 19 |
|---------|----------|----------|
| Next.js 14 | ✓ | ✗ |
| Next.js 15 | ✓ | ✓ |
| Next.js 16 | ✓ | ✓ |
| @solana/web3.js 1.98.x | ✓ | ✓ |
| @solana/wallet-adapter-* 0.15.x | ✓ | ✓ |
| Tailwind 3.x | ✓ | ✓ |
| Tailwind 4.x | ✓ | ✓ |

## Migration Order
1. Solana ecosystem (highest priority)
2. Next.js 14 → 15 → 16
3. React 18 → 19
4. Tailwind 3 → 4
5. TypeScript
6. ESLint
7. Jest

## Files to Modify
- package.json
- tsconfig.json
- tailwind.config.js
- postcss.config.js
- .eslintrc.json
- jest.config.js
- src/components/WalletProvider.tsx
- src/hooks/useWallet.ts
- src/lib/transactions.ts
- src/lib/verification.ts
- src/lib/solana/networkCost.ts
- src/lib/solana/transactionCapabilities.ts
- src/app/layout.tsx
- src/app/page.tsx
- src/app/viewer/page.tsx

## Testing Strategy
1. Run `npm install` after each phase
2. Run `npm run build` to verify compilation
3. Run `npx tsc --noEmit` to verify types
4. Run `npm run lint` to verify linting
5. Run `npm test` to verify tests
6. Manual testing of wallet connection and transaction flow