# Privacy and Permanence

## Public by default

Solana on-chain data should be treated as public and permanent.

Users must be warned before publication that other parties may copy published content and that deleting a website or temporary copy does not erase downloaded copies.

## Product rules

Do not describe HashDrop as private storage.

Do not encourage the publication of:

- passwords
- private keys
- seed phrases
- API secrets
- personal confidential data
- proprietary material the user does not intend to make public

## Permanence Warning

Before publishing, show:

```text
⚠️ Warning: Published content is public and permanent

Once published to Solana, your content will be:
- Publicly accessible via transaction signature
- Permanently stored on-chain
- Copyable by anyone
- Not deletable

Do not publish:
- Passwords or private keys
- Personal confidential information
- Proprietary content you don't intend to share
```

## No Backend Storage

HashDrop does not use:

- Centralized databases
- API servers
- Content databases
- Server-side transaction publishers
- Custodial signing services

## Data Flow

```
User Content
   ↓
Browser (local only)
   ↓
SHA-256 Hash
   ↓
Solana Transaction (SPL Memo)
   ↓
On-chain (public)
```

## User Control

Users control their data by:

- Choosing what to publish
- Using their own wallet
- Verifying content before publishing
- Understanding permanence

## No Data Collection

The application does not:

- Collect user data
- Track usage
- Store content
- Log transactions
- Share information

All processing happens in the browser.