# Security

## Threat model

HashDrop is designed for hostile public environments. Assume:

- users can modify the frontend locally;
- RPC responses can be malformed or stale;
- wallets can reject requests;
- transactions can fail or be replayed;
- users can submit malformed content;
- attackers can attempt unauthorized writes;
- public data can be copied permanently.

## Program security

The program must enforce:

- creator authorization
- valid record state transitions
- valid chunk indexes
- valid chunk sizes
- expected content size
- expected chunk count
- finalization invariants
- immutability after FINALIZED
- deterministic PDA/account relationships

Do not rely on the frontend to enforce security-critical rules.

## Client security

The frontend must:

- validate fetched account structure;
- validate chunk ordering;
- validate expected lengths;
- recompute hashes;
- never trust an RPC response merely because deserialization succeeded.

## RPC Security

The application uses a hybrid Solana architecture:

- **@solana/kit** = PRIMARY RPC layer for all RPC operations
- **@solana/web3.js** = ONLY for Phantom compatibility/signing boundary

**Network Configuration:**
- Devnet: Uses default Solana Devnet RPC (`https://api.devnet.solana.com`)
- Mainnet: Requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` environment variable

**Important:** The application does NOT proxy requests through a backend. RPC requests are made directly from the browser to the configured RPC endpoint. Users should review their RPC provider's privacy policy.

## Sensitive data

Never ask for or store:

- private keys
- seed phrases
- passwords
- API secrets
- confidential files as if they were safe to publish

## Transaction Security

### Signature Verification

Always verify:

1. Transaction is signed by expected wallet
2. Transaction is finalized on-chain
3. Memo instruction is from canonical SPL Memo program
4. Content hash matches

### Replay Protection

Solana transactions are single-use. Each transaction can only be confirmed once.

### Idempotency

Publishing the same content twice creates two separate transactions with different signatures.

## Mainnet

Mainnet deployment requires:

- program review
- authority review
- deployment verification
- fee configuration review
- upgradeability/immutability review
- rollback/incident plan

No production deployment should be performed automatically from an AI coding session.

## Security Checklist

Before mainnet deployment:

- [ ] Program code reviewed
- [ ] Authority keys verified
- [ ] Fee configuration reviewed
- [ ] Upgrade authority disabled (if desired)
- [ ] Treasury configuration verified
- [ ] End-to-end tests pass
- [ ] Security audit completed
- [ ] Incident response plan documented

## RPC Configuration Security

**Do NOT hard-code API keys in source code.**

The application requires `NEXT_PUBLIC_SOLANA_MAINNET_RPC` to be set via environment variable. This is a browser-exposed variable, so:

1. Use a reputable RPC provider (Helius, QuickNode, Alchemy, etc.)
2. Monitor your API key usage
3. Rotate keys if compromised
4. Consider rate limiting at the provider level

**Never commit `.env.local` to version control.** It is already listed in `.gitignore`.