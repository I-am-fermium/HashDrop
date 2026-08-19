# User Experience

## Core journey

```text
Open HashDrop
   ↓
Paste/select content
   ↓
Browser calculates bytes + hash
   ↓
Browser calculates storage/chunks
   ↓
Show transparent costs
   ↓
Connect wallet
   ↓
Create record
   ↓
Sign transaction
   ↓
Send transaction
   ↓
Confirm on-chain
   ↓
Verify from Solana
   ↓
Permanent record
```

## Principles

- Explain what the user is signing.
- Show progress for multi-transaction publishing.
- Never hide a failure.
- Never show success until the record is actually finalized.
- Make permanence and public visibility obvious before signing.
- Make verification independently understandable.

## Error experience

Every failure should tell the user:

- what failed;
- whether funds were spent;
- whether a partial record exists;
- whether retry is safe;
- what action is available next.

## Permanence warning

Before final signing, remind users that finalized public on-chain data should be treated as public and permanent. Do not encourage passwords, private keys, API secrets, or confidential information.

## Transaction Version Display

The UI displays:

- **Transaction Version**: v0 (current) or v1 (target)
- **Transaction Size**: Actual serialized bytes
- **Max Size**: 1232 (v0) or 4096 (v1)
- **Available Bytes**: Remaining space for content

## Content Size Limits

| Version | Max Size | Effective Content |
|---------|----------|-------------------|
| v0      | 1232 B   | ~800 B (base64)   |
| v1      | 4096 B   | ~2800 B (base64)  |

## Cost Display

Before signing, shows:

- Protocol Fee: 0.001 SOL
- Network Fee: ~0.000005 SOL
- Total: ~0.001005 SOL

## Wallet States

- disconnected
- connecting
- connected
- transaction awaiting approval
- transaction submitted
- confirmation pending
- confirmed
- rejected
- expired
- insufficient funds
- RPC failure