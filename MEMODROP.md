# HashDrop Memo Drop Specification

## 1. Purpose

Memo Drop adds a second publishing method to HashDrop.

HashDrop must support two distinct publication paths:

1. **Memo Drop** — publish small content directly inside a Solana transaction using the SPL Memo program.
2. **Storage Drop** — use the existing HashDrop on-chain storage/account system for content that requires account-backed storage.

Memo Drop is intended to become the preferred method for small content because it does not require a separate rent-funded storage account.

Solana's official Cookbook documents adding a memo instruction using the SPL Memo program. The official Solana IDL explorer identifies the canonical Memo program as:

`Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`

Reference: https://solana.com/developers/cookbook/transactions/add-memo

---

## 2. Product Concept

A HashDrop is still one product regardless of publication method.

Conceptually:

User Content
→ Normalize / UTF-8 Encode
→ Calculate Hash
→ Select Publication Method
→ Build Solana Transaction
→ Sign With User Wallet
→ Confirm On-Chain
→ Create / Display HashDrop ID
→ Verify Later

Publication Method:

- Memo Drop
- Storage Drop

Do not make Memo Drop a separate application or separate visual identity.

---

## 3. Memo Drop

### Definition

Memo Drop publishes the user's content using the SPL Memo program as a transaction instruction.

Example:

```text
Wallet
  |
  +-- Solana transaction
       |
       +-- Memo instruction
            |
            +-- HashDrop memo payload
```

No dedicated HashDrop storage account should be created for a Memo Drop unless a future feature explicitly requires one.

The transaction itself is the publication record.

---

## 4. Memo Payload Design

Do not blindly place arbitrary application metadata into the memo.

HashDrop should use an explicit versioned payload format.

Recommended logical format:

```text
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

---

## 5. Hashing

Hash calculation must remain independent of the publication method.

The same input must produce the same HashDrop content hash whether the user chooses:

- Memo Drop
- Storage Drop

---

## 6. Content Encoding

Memo Drop must use UTF-8 bytes.

Never use JavaScript `string.length` as a byte-size calculation.

Use the project's existing byte-encoding utilities where possible.

---

## 7. Transaction Construction

Memo Drop should construct a normal Solana transaction containing the Memo instruction.

The implementation uses `@solana-program/memo` from the Solana Kit ecosystem.

---

## 8. Wallet

Memo Drop must reuse the existing HashDrop wallet connection.

The flow must be:

```text
Connect Wallet
      ↓
Select Memo Drop
      ↓
Build transaction
      ↓
Wallet signs
      ↓
Send transaction
      ↓
Confirm on-chain
      ↓
Show signature
```

Phantom and other wallets supported by the existing wallet adapter should continue to work.

---

## 9. Fees

Memo Drop has a different cost model from Storage Drop.

### Memo Drop

Expected components:

```text
Solana transaction/base fee
+
optional priority fee
+
HashDrop protocol fee
```

There should be:

```text
NO separate HashDrop storage-account rent funding
```

for a pure Memo Drop.

Do not label a transaction fee as "storage funding."

---

## 10. Dynamic Fee Estimation

Do not hardcode the network transaction fee.

The transaction fee should be estimated from the actual transaction/signature configuration and current network conditions using the project's supported Solana APIs.

Memo Drop must also account for optional priority fees if the application uses them.

The user-facing estimate must be clearly labeled as an estimate until the transaction is finalized.

After confirmation, the application should display the actual transaction signature and, where feasible, the finalized fee information.

---

## 11. Memo Size Safety

Memo Drop must not assume that arbitrarily large content can fit into one Solana transaction.

Transaction size is constrained by the Solana transaction format and by the size of signatures, account addresses, instructions, and memo payload.

The application must validate the complete transaction before attempting to send it.

Important:

Do not determine the maximum memo size solely from the memo string length.

The final serialized transaction size matters.

The application should provide a safe application-level maximum smaller than the protocol ceiling, leaving room for transaction overhead.

The exact safe maximum must be measured/validated by the implementation rather than guessed.

Solana is rolling out a larger transaction format in 2026, increasing the maximum transaction size from 1232 bytes to 4096 bytes for the new v1 transaction format.

Therefore:

- keep Memo Drop compatible with the current transaction format used by HashDrop;
- use serialization-based size validation;
- do not make the 4096-byte value a hardcoded memo payload limit;
- revisit the limit if/when HashDrop adopts v1 transactions.

---

## 12. Transaction Version Support

### Current Implementation (v0)

- **Max Size**: 1232 bytes
- **Effective Content**: ~800 bytes (after base64 encoding)
- **Wallet Support**: Phantom, Brave

### Target Implementation (v1)

- **Max Size**: 4096 bytes
- **Effective Content**: ~2800 bytes (after base64 encoding)
- **Wallet Support**: Pending Phantom v1 signing support
- **SDK Support**: ✅ Available (web3.js 1.98.4, Kit 7.1.1)

---

## 13. Verification

Memo Drop verification is fundamentally different from Storage Drop verification.

For Memo Drop:

```text
HashDrop ID
      ↓
Transaction signature
      ↓
Fetch transaction
      ↓
Find canonical Memo instruction
      ↓
Extract memo
      ↓
Decode HashDrop payload
      ↓
Recalculate content hash
      ↓
Compare hashes
      ↓
Verified / Invalid
```

The verifier must verify that the memo came from the expected Memo program and is part of the referenced transaction.

Do not treat arbitrary transaction log text as a valid HashDrop memo.

---

## 14. Transaction Signature

A successful Memo Drop must retain the Solana transaction signature.

The UI should provide:

```text
Published
Transaction: <signature>
[View on Explorer]
```

The signature is the primary on-chain locator for the Memo Drop.

Do not require a backend database to remember it.

---

## 15. Decentralization Requirement

Memo Drop must preserve HashDrop's no-backend architecture.

Do not add:

- central database
- API server
- content database
- server-side transaction publisher
- custodial signing service

The user's wallet must sign the transaction.

The Solana network remains the source of truth.

---

## 16. Storage Drop Compatibility

Do not delete or break the current Storage Drop system.

Both systems must coexist:

```text
              HashDrop
                 |
      Publication Method
         /           \
        /             \
  Memo Drop       Storage Drop
      |                |
 Transaction memo   Account storage
      |                |
   Tx signature       Account/PDA
```

Existing Storage Drop functionality must continue working exactly as before unless a separately approved bug is discovered.

---

## 17. Error Handling

Memo Drop must handle at minimum:

- wallet not connected
- user rejected signature
- insufficient SOL
- blockhash expiration
- transaction simulation failure
- transaction too large
- invalid memo payload
- unsupported wallet behavior
- RPC failure
- confirmation timeout
- transaction not found
- malformed memo during verification

Errors should be user-readable.

Do not expose raw RPC errors as the primary UI message.

---

## 18. Testing Requirements

Add tests for:

### Encoding

- ASCII
- Unicode
- emoji
- empty content
- long content

### Hash consistency

The same content must generate the same HashDrop hash in both publication modes.

### Memo payload

- encode/decode round trip
- version validation
- malformed payload rejection

### Transaction

- memo instruction creation
- correct Memo program ID
- transaction serialization
- transaction size validation

### Verification

- valid memo
- wrong program
- altered memo
- wrong hash
- missing memo
- malformed memo

### Regression

All existing Storage Drop tests must continue to pass.

---

## 19. No Unnecessary Dependency Changes

Before adding packages:

1. inspect `package.json`;
2. inspect lockfile;
3. determine whether a Memo package is already installed;
4. reuse the existing Solana stack where practical.

Do not migrate:

- web3.js → Kit
- wallet adapter
- Next.js
- TypeScript architecture

as part of this feature unless the existing project requires it.

Memo Drop should be an incremental feature.

---

## 20. Security

Never trust memo content merely because it is readable from a transaction.

Verification must check:

1. transaction exists;
2. transaction is finalized/confirmed according to the application's verification policy;
3. Memo instruction belongs to the canonical SPL Memo program;
4. payload format is valid;
5. content hash matches;
6. transaction signature is the expected on-chain identifier.

Never sign transactions with a server-held private key.

Never store wallet private keys.

Never claim a memo is permanently verified based only on a frontend-generated hash.

---

## 21. Mainnet / Devnet

Memo Drop must respect the same selected network as the rest of HashDrop.

The network displayed in the UI must match:

- RPC endpoint
- wallet transaction
- explorer link
- verification endpoint

Do not allow a Devnet UI to accidentally submit to Mainnet or vice versa.

---

## 22. Definition of Done

Memo Drop is complete only when:

- [x] User can select Memo Drop.
- [x] Wallet connection is reused.
- [x] Memo instruction is built correctly.
- [x] Canonical Memo program is used.
- [x] Content is encoded deterministically as UTF-8.
- [x] Existing HashDrop hashing is reused.
- [x] No storage account is created for pure Memo Drop.
- [x] Network fee is estimated separately.
- [x] Protocol fee is displayed separately.
- [x] Storage funding is not charged for Memo Drop.
- [x] Transaction size is validated.
- [x] Transaction is signed by the user's wallet.
- [x] Transaction is confirmed.
- [x] Transaction signature is displayed.
- [x] Explorer link works.
- [x] Memo can be independently verified.
- [x] Hash verification works.
- [x] Errors are handled cleanly.
- [x] Storage Drop still works.
- [x] Existing tests pass.
- [x] New Memo Drop tests pass.
- [ ] Devnet end-to-end test succeeds.

---

## 23. Engineering Rule

Do not duplicate HashDrop logic.

Reuse existing:

- content encoding
- hashing
- wallet connection
- network configuration
- transaction utilities
- fee utilities
- verification utilities
- UI primitives
- HashDrop ID generation

Memo Drop should be an additional publication adapter, not a second application.

---

## 24. Official References

Solana — Add a Memo to a Transaction:
https://solana.com/developers/cookbook/transactions/add-memo

Solana — Larger Transaction Sizes:
https://solana.com/upgrades/larger-transaction-sizes

Solana — Official TypeScript/Client documentation:
https://solana.com/docs/clients

Solana — Programs:
https://solana.com/docs/core/programs

Canonical SPL Memo program address:

`Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`

---

## 25. Final Principle

HashDrop should make the simplest path cheap and obvious:

```text
Tiny content
    ↓
Memo Drop
    ↓
Solana transaction
    ↓
Verified on-chain HashDrop
```

Larger/account-backed content should continue to use:

```text
Larger / structured content
    ↓
Storage Drop
    ↓
HashDrop account storage
    ↓
Verified on-chain HashDrop
```

Both methods are first-class HashDrop publication methods.