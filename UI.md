# UI Design System

## Visual identity

HashDrop uses:

- black background
- white primary text
- muted gray secondary text
- red accent/action color
- thin borders
- compact spacing
- developer/terminal-inspired typography

Avoid:

- excessive gradients
- glassmorphism
- noisy Web3 decoration
- unnecessary animations
- colorful dashboards

## Main screens

1. Landing / Create Drop
2. Wallet connection
3. Fee + storage estimate
4. Upload/write progress
5. Success / permanent record
6. HashDrop viewer
7. Wallet-owned Drops list
8. About / Docs

## Create screen

The primary action should be obvious:

- input/paste area
- content type/language
- byte size
- content hash
- estimated storage
- protocol fee
- total
- connect wallet / publish button

## Network Selector

The UI includes a network selector that allows users to switch between:

- Devnet (default)
- Mainnet (requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC`)

## Transaction Info Display

The UI displays transaction information:

- **Transaction Version**: v0 (current), v1 (target)
- **Transaction Size**: Actual serialized bytes
- **Max Size**: 1232 (v0) or 4096 (v1)
- **Available Bytes**: Remaining space for content

## RPC Architecture

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

## Viewer

Display:

- HashDrop ID
- creator wallet
- status
- type/language
- byte size
- chunk count
- content hash
- creation reference
- verification result
- readable content

The viewer must distinguish clearly between:

- FOUND
- LOADING
- VERIFIED ON-CHAIN
- VERIFICATION FAILED
- INVALID/CORRUPT STATE

## Mobile

The same critical lifecycle must work on small screens. Do not make desktop-only controls essential for publishing or verification.

## Confirmation Modal

Before publishing, shows:

- Method: HashDrop Memo Drop
- Content size
- Protocol Fee: 0.001 SOL
- Network Fee: ~0.000005 SOL
- Total cost: ~0.001005 SOL
- Transaction version: v0 (1232-byte limit)
- Warning about Solana transaction
- Cancel and Confirm buttons

## Network Warning

When Mainnet is selected, the UI displays:

```text
Mainnet Warning: This will send real SOL from your wallet. Transactions are permanent.
```

This warning only appears after the component has mounted to prevent hydration mismatch.