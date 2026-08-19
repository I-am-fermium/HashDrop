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