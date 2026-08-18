# MEMODROP.md

## HashDrop Memo Drop Specification

### 1. Purpose

Memo Drop adds a second publishing method to HashDrop.

HashDrop must support two distinct publication paths:

1. **Memo Drop** — publish small content directly inside a Solana transaction using the SPL Memo program.
2. **Storage Drop** — use the existing HashDrop on-chain storage/account system for content that requires account-backed storage.

Memo Drop is intended to become the preferred method for small content because it does not require a separate rent-funded storage account merely to hold the memo.

Solana's official Cookbook documents adding a memo instruction using the SPL Memo program. The official Solana IDL explorer identifies the canonical Memo program as:

`Memo4c2pN8afCj432Lb7RMVKi9PbQnnW7ewFFaV3oAH`

Reference:
https://solana.com/developers/cookbook/transactions/add-memo

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
HASHDROP|v1|<payload>
```

For example:

```text
HASHDROP|v1|Hello, HashDrop!
```

However, the implementation should use a deterministic encoding strategy and keep the payload as compact as practical.

A richer format may be introduced later, but v1 should remain simple.

Recommended future-compatible logical fields:

```text
protocol
version
content type
content or content reference
content hash
optional metadata
```

Do not add fields until they are required.

---

## 5. Hashing

Hash calculation must remain independent of the publication method.

The same input must produce the same HashDrop content hash whether the user chooses:

- Memo Drop
- Storage Drop

Do not hash one representation for Memo Drop and a different representation for Storage Drop unless the difference is explicitly documented.

Preferred flow:

```text
Raw User Content
      ↓
Canonical UTF-8 bytes
      ↓
Content Hash
      ↓
Memo / Storage publication
```

The existing hashing implementation must be reused instead of creating a second hashing system.

---

## 6. Content Encoding

Memo Drop must use UTF-8 bytes.

Never use JavaScript `string.length` as a byte-size calculation.

Use the project's existing byte-encoding utilities where possible.

Example concept:

```ts
const bytes = new TextEncoder().encode(content);
const byteLength = bytes.length;
```

The implementation must remain correct for:

- ASCII
- emoji
- accented characters
- non-Latin scripts
- mixed Unicode content

Example:

```text
Hello
你好
🚀
```

must not be treated as having one byte per JavaScript character.

---

## 7. Transaction Construction

Memo Drop should construct a normal Solana transaction containing the Memo instruction.

The official Solana Cookbook demonstrates the modern Solana Kit approach with:

```ts
import { getAddMemoInstruction } from "@solana-program/memo";
```

The existing HashDrop project currently appears to use a legacy/older Solana TypeScript stack in places, so integration must follow the project's existing dependency and transaction architecture unless a migration is explicitly approved.

Do not perform a broad Solana SDK migration just to add Memo Drop.

If the project currently uses `@solana/web3.js` and `@solana/spl-memo`, prefer those existing project conventions if compatible.

---

## 8. Wallet

Memo Drop must reuse the existing HashDrop wallet connection.

Do not create a second wallet integration.

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
Confirm
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

### Storage Drop

The existing Storage Drop cost model remains separate:

```text
Protocol Fee
+
Storage/Rent Funding
+
Transaction Fee
+
Optional Priority Fee
```

The UI must keep these concepts separate.

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

Solana is also rolling out a larger transaction format in 2026, increasing the maximum transaction size from 1232 bytes to 4096 bytes for the new v1 transaction format. Existing legacy/v0 applications continue to work. Do not assume every connected wallet or current transaction-building path automatically uses the new format.

Reference:
https://solana.com/upgrades/larger-transaction-sizes

Therefore:

- keep Memo Drop compatible with the current transaction format used by HashDrop;
- use serialization-based size validation;
- do not make the 4096-byte value a hardcoded memo payload limit;
- revisit the limit if/when HashDrop adopts v1 transactions.

---

## 12. Memo vs Storage Routing

HashDrop should recommend a publication method based on content size and requirements.

Initial rule:

```text
Small content
    → Memo Drop recommended

Content requiring account-backed storage
    → Storage Drop recommended
```

Do not automatically route to Storage Drop merely because content exceeds an arbitrary number unless that threshold is defined and tested.

The application should show the reason for the recommendation.

Example:

```text
Memo Drop recommended
Small content. No storage account required.
```

or:

```text
Storage Drop recommended
This content requires account-backed storage.
```

The user may be allowed to choose manually when both methods are valid.

---

## 13. UI Requirements

The existing HashDrop visual language must remain unchanged.

Do not redesign the application.

Use the existing:

- black background
- dark cards
- red accent
- monospace/technical typography
- existing spacing and component conventions

Add a publication-method selector to the existing flow.

Suggested presentation:

```text
Publish Method

[ Memo Drop ]
Small content • transaction-based • no storage account

[ Storage Drop ]
Account-backed on-chain storage
```

The current cost card should dynamically change based on the selected method.

### Memo Drop selected

```text
Costs

HashDrop Protocol Fee:   X.XXXXXX SOL
Solana Network Fee:      X.XXXXXX SOL
Priority Fee:            X.XXXXXX SOL
────────────────────────────────────
Estimated Total:         X.XXXXXX SOL
```

Do not display:

```text
Solana Storage Funding
```

for a pure Memo Drop.

### Storage Drop selected

Preserve the existing cost structure.

---

## 14. HashDrop ID

Memo Drop should continue to use the HashDrop ID system.

Do not create a separate ID format unless required.

The ID should clearly indicate its publication method if the existing architecture supports that safely.

Possible future concept:

```text
hd_<hash>_<method>_<status>
```

Do not change the existing HashDrop ID format during the initial Memo Drop integration unless the project already specifies such a change.

Backward compatibility is more important.

---

## 15. Verification

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

## 16. Transaction Signature

A successful Memo Drop must retain the Solana transaction signature.

The UI should provide:

```text
Published
Transaction: <signature>
[View on Explorer]
```

The signature is the primary on-chain locator for the Memo Drop.

Do not require a backend database to remember it.

If local persistence is used, it should be treated as convenience only, not as the source of truth.

---

## 17. Decentralization Requirement

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

## 18. Storage Drop Compatibility

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

## 19. Error Handling

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

Example:

```text
Transaction failed

Your wallet rejected the signature request.
No SOL was published.
```

---

## 20. Testing Requirements

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

### Routing

- Memo Drop recommendation
- Storage Drop recommendation
- boundary conditions

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

## 21. No Unnecessary Dependency Changes

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

## 22. Security

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

## 23. Mainnet / Devnet

Memo Drop must respect the same selected network as the rest of HashDrop.

The network displayed in the UI must match:

- RPC endpoint
- wallet transaction
- explorer link
- verification endpoint

Do not allow a Devnet UI to accidentally submit to Mainnet or vice versa.

---

## 24. Migration Strategy

Implement Memo Drop incrementally.

### Phase 1

Add a reusable memo payload encoder/decoder.

### Phase 2

Add Memo transaction construction using the existing transaction architecture.

### Phase 3

Add Memo Drop cost estimation.

### Phase 4

Add Memo Drop UI.

### Phase 5

Add Memo Drop verification.

### Phase 6

Add tests and regression checks.

### Phase 7

Run Devnet end-to-end testing.

### Phase 8

Review for Mainnet readiness.

Do not delete Storage Drop.

---

## 25. Definition of Done

Memo Drop is complete only when:

- [ ] User can select Memo Drop.
- [ ] Wallet connection is reused.
- [ ] Memo instruction is built correctly.
- [ ] Canonical Memo program is used.
- [ ] Content is encoded deterministically as UTF-8.
- [ ] Existing HashDrop hashing is reused.
- [ ] No storage account is created for pure Memo Drop.
- [ ] Network fee is estimated separately.
- [ ] Protocol fee is displayed separately.
- [ ] Storage funding is not charged for Memo Drop.
- [ ] Transaction size is validated.
- [ ] Transaction is signed by the user's wallet.
- [ ] Transaction is confirmed.
- [ ] Transaction signature is displayed.
- [ ] Explorer link works.
- [ ] Memo can be independently verified.
- [ ] Hash verification works.
- [ ] Errors are handled cleanly.
- [ ] Storage Drop still works.
- [ ] Existing tests pass.
- [ ] New Memo Drop tests pass.
- [ ] Devnet end-to-end test succeeds.

---

## 26. Engineering Rule

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

Recommended architectural concept:

```text
PublicationService
       |
       +---- MemoPublisher
       |
       +---- StoragePublisher
```

The exact implementation should follow the existing project architecture rather than introducing unnecessary abstraction.

---

## 27. Official References

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

## 28. Final Principle

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
