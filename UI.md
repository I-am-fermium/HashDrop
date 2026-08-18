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
