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
Write chunks
   ↓
Finalize
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
