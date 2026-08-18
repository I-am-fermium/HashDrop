# HashDrop — Upgrade Memo Drop for Solana v1 / 4096-Byte Transactions

## IMPORTANT

The existing HashDrop application is already working.

The current application successfully supports:

* V2 Memo publishing
* Solana Devnet
* Phantom / Brave wallet
* SHA-256
* HashDrop ID generation
* V2 Memo retrieval
* Base58 Solana instruction decoding
* Base64 V2 content decoding
* SHA-256 verification
* zero-backend architecture
* Memo Drop only

DO NOT rebuild the application.

DO NOT reintroduce Storage Drop.

DO NOT rewrite the V2 protocol.

This task is specifically to upgrade the **Memo Drop transaction capacity and transaction builder** so the application can use Solana's newer **v1 transaction format and 4096-byte maximum transaction size when the active network/RPC/wallet support it**.

---

# 1. CURRENT PROBLEM

The HashDrop application currently uses an application-level content limit of approximately:

```text
1024 bytes
```

This is an artificial limitation in the application.

We want to remove that old small limit.

The target is:

```text
4096 bytes TOTAL TRANSACTION SIZE
```

when Solana v1 is available.

IMPORTANT:

Do NOT interpret this as:

```text
4096 bytes of user content
```

The 4096-byte ceiling applies to the complete serialized v1 transaction.

Therefore:

```text
Transaction size =
signatures
+ account keys
+ blockhash
+ instruction metadata
+ Memo instruction
+ V2 payload
```

The actual content capacity is smaller than 4096 bytes.

---

# 2. SOLANA NETWORK FACT

Solana's larger transaction-size upgrade raises the maximum transaction size from:

```text
1232 bytes
```

to:

```text
4096 bytes
```

through the new:

```text
v1 transaction format
```

Existing:

```text
legacy
v0
```

transactions remain unchanged.

Do NOT simply increase a constant from 1024 to 4096 while continuing to build legacy/v0 transactions.

The implementation must actually use a v1 transaction whenever the active Solana environment supports it.

Solana documentation reference:

```text
https://solana.com/upgrades/larger-transaction-sizes
```

---

# 3. PRIMARY OBJECTIVE

Upgrade the existing Memo Drop system so that it:

1. Detects/uses Solana v1 transaction support where available.
2. Uses the 4096-byte limit for v1 transactions.
3. Calculates the REAL serialized transaction size.
4. Calculates the actual available space for the V2 Memo payload.
5. Rejects content only when the COMPLETE transaction is too large.
6. Does NOT use a hardcoded 1024-byte content limit.
7. Preserves all existing V2 Memo behavior.
8. Preserves current retrieval compatibility.
9. Does NOT add Storage Drop.
10. Does NOT add a backend.

---

# 4. DO NOT CHANGE

DO NOT modify:

* HashDrop V2 Memo format
* HashDrop ID generation
* SHA-256 generation
* Base58 retrieval logic
* Base64 content decoding
* retrieval UI
* verification UI
* Storage Drop
* wallet connection architecture
* existing Devnet RPC architecture
* protocol fee logic
* unrelated application UI

Only modify transaction construction, transaction-version selection, size validation, and closely related Memo Drop code.

---

# 5. FIRST: INSPECT THE CURRENT PROJECT

Before editing, search the project for:

```text
1024
1000
1KB
1 KB
MAX_CONTENT_SIZE
MAX_MEMO_SIZE
MEMO_MAX_SIZE
MAX_TRANSACTION_SIZE
1232
transaction size
serialize()
Transaction
VersionedTransaction
MessageV0
legacy
v0
v1
```

Also inspect:

```text
Memo Drop transaction builder
Memo instruction builder
Solana connection
wallet sendTransaction
size validation
cost estimation
publish validation
```

Report:

```text
Current content limit:
Current transaction type:
Current transaction builder:
Current Memo builder:
Current size validation:
Current wallet signing method:
Files that need modification:
```

DO NOT edit until this inspection is complete.

---

# 6. PRESERVE V2 MEMO FORMAT

The existing V2 Memo remains:

```text
HASHDROP|v2|MEMO|<hashDropId>|<sha256>|<mimeType>|<length>|<base64Content>
```

Do NOT change this protocol in this task.

The upgrade is about the Solana transaction container, not the V2 Memo protocol.

---

# 7. IMPORTANT: BASE58 / BASE64

Do not change the existing working encoding model.

Solana instruction representation:

```text
RPC instruction data
↓
Base58 decode when required
↓
Memo bytes
↓
UTF-8
```

V2 content:

```text
Base64 content field
↓
original content bytes
```

The transaction-size upgrade must not change these encoding rules.

---

# 8. CURRENT LEGACY/V0 SUPPORT

First determine exactly how the existing app constructs transactions.

If it currently uses:

```ts
new Transaction()
```

or:

```ts
TransactionMessage.compileToV0Message()
```

document that.

Do NOT assume that replacing a class name automatically enables v1.

---

# 9. V1 TRANSACTION IMPLEMENTATION

Investigate the installed versions of:

```text
@solana/web3.js
@solana/kit
wallet-adapter
```

and determine whether the project's current dependencies can actually construct/sign/send Solana v1 transactions.

If the installed SDK does not support v1:

1. Do NOT fake v1 support.
2. Do NOT serialize an invalid custom format.
3. Determine the minimum dependency upgrade required.
4. Report the required package/version changes.
5. Only upgrade dependencies that are necessary for v1 support.
6. Preserve current working V2 Memo functionality.

The final application must use a real Solana v1 transaction format when claiming 4096-byte support.

---

# 10. V1 AVAILABILITY MUST BE VERIFIED

Do not hardcode:

```text
v1Available = true
```

without evidence.

Determine whether the current target environment supports v1 transaction submission.

The application should have a capability model conceptually like:

```ts
type SolanaTransactionCapabilities = {
  supportsV1: boolean;
  maxTransactionBytes: number;
  preferredVersion: 'v1' | 'v0' | 'legacy';
};
```

Adapt this to the project's architecture.

---

# 11. DO NOT CLAIM 4096 IF V1 IS UNAVAILABLE

If the connected network / SDK / wallet path cannot actually support v1:

The application must NOT claim:

```text
4096 bytes available
```

Instead, safely use the currently supported transaction format and limit.

For example:

```text
Legacy/V0:
current supported transaction size

V1:
4096 bytes
```

The UI should reflect the actual active transaction version.

---

# 12. TRANSACTION VERSION SELECTION

Preferred logic:

```text
Can use v1?
    YES
      ↓
Use v1
      ↓
4096-byte transaction ceiling

    NO
      ↓
Use currently supported transaction format
      ↓
Use its real transaction ceiling
```

Do not silently call an oversized transaction "valid" because the content alone is under 4096 bytes.

---

# 13. DYNAMIC TRANSACTION SIZE

This is the most important implementation requirement.

DO NOT do:

```ts
if (contentBytes.length > 1024) reject();
```

DO NOT do:

```ts
if (contentBytes.length > 4096) reject();
```

Instead:

```text
content
↓
build exact V2 Memo payload
↓
build exact transaction
↓
serialize exact transaction
↓
calculate serialized byte length
↓
compare with ACTIVE_TRANSACTION_LIMIT
```

Conceptually:

```ts
const transaction = buildMemoTransaction(content);

const serialized = serializeTransaction(transaction);

const transactionBytes = serialized.length;

if (transactionBytes > activeLimit) {
  rejectOversizedContent();
}
```

Use the correct serialization API for the installed SDK and transaction version.

---

# 14. AVAILABLE CONTENT CAPACITY

The UI should show the user the ACTUAL available capacity.

Do not say:

```text
4096 bytes of content available
```

Instead display something like:

```text
Transaction:
2,940 / 4,096 bytes

Content:
2,120 bytes

Remaining:
1,156 bytes
```

The exact calculation must come from the actual transaction.

---

# 15. BUILD-BEFORE-VALIDATE

The correct order is:

```text
1. Convert content to UTF-8 bytes
2. Calculate SHA-256
3. Generate HashDrop ID
4. Build V2 Memo payload
5. Build Memo instruction
6. Build transaction using active transaction version
7. Set fee payer
8. Set recent blockhash
9. Serialize transaction
10. Calculate actual size
11. Reject if too large
12. Request wallet approval
13. Send
14. Confirm
```

Do not validate using assumptions before building the actual transaction.

---

# 16. SIZE MARGIN

Do NOT add an arbitrary huge safety margin that unnecessarily reduces capacity.

The serialization of the exact transaction is authoritative.

If the protocol/network defines an absolute maximum:

```text
activeLimit = 4096
```

then:

```text
serializedTransaction.length <= 4096
```

is the final condition.

If the SDK/wallet requires additional constraints, document them explicitly.

---

# 17. V1 TRANSACTION FORMAT

Do not confuse:

```text
legacy
v0
v1
```

The implementation must explicitly identify the transaction version being built.

For v1:

```text
transactionVersion = v1
maximumTransactionBytes = 4096
```

For legacy/v0:

use the currently applicable transaction size limit.

Do not pretend legacy/v0 has a 4096-byte ceiling.

---

# 18. IMPORTANT V1 DETAIL

Solana's v1 transaction format is a real protocol format.

Do not implement a fake local "v1" type.

Do not prepend arbitrary bytes.

Do not create a custom serializer unless the official SDK/protocol implementation requires it.

Use the official supported Solana SDK APIs for v1 transaction construction.

---

# 19. WALLET SUPPORT

Inspect the existing wallet adapter.

Verify whether the connected wallet can:

1. accept v1 transactions
2. sign v1 transactions
3. send v1 transactions

Do NOT break wallets that currently support legacy/v0.

If wallet v1 support is unavailable:

```text
do not claim 4096 support
```

and provide a clear developer diagnostic.

---

# 20. DEVNET TESTING

The development target is:

```text
Solana Devnet
```

Before claiming v1 support, actually submit a small test V1 transaction on Devnet.

Verify:

```text
transaction sent
transaction confirmed
transaction finalized
transaction version = v1
```

Do not declare success based only on local serialization.

---

# 21. TEST THE SIZE BOUNDARY

Create tests for:

### Small content

```text
100 bytes
```

Must publish.

### Medium content

```text
1000 bytes
```

Must publish if transaction fits.

### Larger content

```text
2000 bytes
```

Must publish if the final serialized transaction fits.

### Near-limit content

Generate content so the complete serialized transaction is:

```text
4090–4095 bytes
```

Must publish if the active v1 transaction limit is 4096.

### Exactly at limit

Generate a transaction whose serialized length is:

```text
4096 bytes
```

Must be accepted if Solana/client/wallet accepts the boundary.

### Over limit

Generate:

```text
4097+ bytes
```

Must be rejected before wallet signing.

IMPORTANT:

These tests must generate content based on ACTUAL serialized transaction size rather than assuming content length equals transaction length.

---

# 22. TEST UNICODE

Test:

```text
Hello HashDrop
```

```text
Hello HashDrop 🚀
```

```text
你好，HashDrop
```

```text
مرحبا HashDrop
```

Use UTF-8 byte lengths.

Do NOT use JavaScript string `.length` for transaction capacity calculations.

---

# 23. TEST BASE64 OVERHEAD

The current V2 protocol Base64-encodes content.

Do not change V2 in this task.

Measure:

```text
raw content bytes
vs
Base64 content bytes
vs
final Memo payload bytes
vs
final serialized transaction bytes
```

Make the actual size visible during development.

---

# 24. HASHDROP USER EXPERIENCE

The Publish page should display something like:

```text
Memo Drop

Content:
[................................]

HashDrop ID:
hd_xxxxx

Transaction:
2,984 / 4,096 bytes

Content:
2,140 bytes

Network:
Solana Devnet

Estimated Network Fee:
0.000005 SOL

[ PUBLISH ]
```

Do not show "Storage Drop."

There is no Storage Drop.

---

# 25. REMOVE THE OLD 1024-BYTE LIMIT

Find the existing source of the `1024`/`1KB` limit.

Remove the old artificial restriction.

Do NOT replace it with another arbitrary fixed content limit.

Replace it with dynamic transaction serialization validation.

---

# 26. IMPORTANT: DO NOT BREAK EXISTING V2

The following currently working transaction must remain retrievable:

```text
Transaction:
5QSigbpsA4siqaTpGza3Q4kMFrwSzUKXn5TSkzJFyLxy8EdARYgwhFaMw69cGD3x1DruTZt2GweRB65c3GXCsyYg
```

HashDrop ID:

```text
hd_e0ba1ac4_Amy4Tej8_g
```

Content:

```text
Hello, HashDrop!
```

The Retrieve page must still show:

```text
✅ VERIFIED
```

---

# 27. PUBLISH ACCEPTANCE TEST

After the upgrade, create a new larger Memo Drop.

Test at least:

```text
~1500 bytes
~2000 bytes
~2500 bytes
```

For each one:

```text
Publish
↓
Wallet
↓
Devnet
↓
Finalized
↓
Retrieve
↓
SHA-256
↓
✅ VERIFIED
```

---

# 28. VERIFY ACTUAL TRANSACTION VERSION

After publishing, retrieve the transaction and inspect:

```text
transaction version
```

The test must confirm whether it is:

```text
v1
```

when the 4096-byte path is used.

Do not accept:

```text
legacy
```

while claiming the application is using the 4096-byte limit.

---

# 29. RETRIEVAL COMPATIBILITY

The existing retrieval page must remain able to handle:

```text
legacy V2 Memo transactions
v0 V2 Memo transactions
v1 V2 Memo transactions
```

provided the transaction itself contains a valid HashDrop V2 Memo.

Retrieval should not assume all transactions are legacy.

Do not rewrite the successful Memo parser unnecessarily.

---

# 30. IMPORTANT: getTransaction

The current retrieval system already works.

Preserve:

```ts
connection.getTransaction(...)
```

behavior.

Ensure the retrieval path can inspect v1 transactions once v1 transactions begin being published.

Use the official RPC response fields and the installed SDK's correct transaction types.

Do not break current legacy/V0 retrieval.

---

# 31. COST

Do not assume larger transactions cost exactly the same in all network conditions.

Keep the actual network fee calculation.

Do not create a fake "4KB fee."

The transaction should still use actual Solana network fee information.

Larger transactions may be affected by prioritization conditions; do not hardcode assumptions.

---

# 32. NO STORAGE DROP

Absolutely do NOT reintroduce:

```text
Storage Drop
Storage Account
Chunking
Storage Funding
Storage Program
```

If content is too large even for v1:

```text
Content too large for HashDrop Memo Drop.
```

The application rejects it.

---

# 33. TEST MATRIX

Run:

| Test                        | Expected                    |
| --------------------------- | --------------------------- |
| 100-byte text               | Publish                     |
| 1KB text                    | Publish                     |
| 1.5KB text                  | Publish if transaction fits |
| 2KB text                    | Publish if transaction fits |
| 2.5KB text                  | Publish if transaction fits |
| Near 4096 transaction bytes | Publish                     |
| 4096 transaction bytes      | Test boundary               |
| >4096 transaction bytes     | Reject                      |
| Unicode                     | Correct UTF-8               |
| Newlines                    | Preserved                   |
| Emoji                       | Preserved                   |
| Hash verification           | PASS                        |
| Retrieval                   | PASS                        |
| Legacy V2 retrieval         | PASS                        |
| v0 V2 retrieval             | PASS                        |
| v1 V2 retrieval             | PASS                        |

---

# 34. DEBUGGING

Add temporary development diagnostics:

```ts
console.log('[HashDrop Size]', {
  transactionVersion,
  serializedTransactionBytes,
  activeTransactionLimit,
  contentBytes,
  memoPayloadBytes,
});
```

Before wallet signing:

```text
transactionVersion
serializedBytes
limit
```

After confirmation:

```text
signature
slot
version
```

Do not log secrets.

---

# 35. FINAL ARCHITECTURE

The final Memo Drop architecture should be:

```text
                     HASHDROP V2

                       Content
                          ↓
                    UTF-8 bytes
                          ↓
                      SHA-256
                          ↓
                     HashDrop ID
                          ↓
                    V2 Memo Payload
                          ↓
              ┌───────────┴───────────┐
              │                       │
          v1 available          v1 unavailable
              │                       │
              ↓                       ↓
        Solana v1 tx            existing supported tx
              │
              ↓
      Dynamic serialize()
              │
              ↓
       ≤ 4096 bytes
              │
              ↓
        Wallet signs
              │
              ↓
        Solana Devnet
              │
              ↓
          Finalized
              │
              ↓
          Retrieval
              │
              ↓
       SHA-256 verify
              │
              ↓
          ✅ VERIFIED
```

---

# 36. DO NOT DECLARE SUCCESS TOO EARLY

The upgrade is NOT complete merely because:

```text
4096
```

appears in the UI.

It is complete only if:

1. A real Solana v1 transaction is constructed.
2. The transaction is actually accepted by Devnet.
3. The transaction can approach/use the 4096-byte ceiling.
4. Wallet signing works.
5. The transaction is finalized.
6. Retrieval can read the V1 transaction.
7. V2 Memo parsing still works.
8. Content is recovered exactly.
9. SHA-256 matches.
10. Existing legacy/V0 V2 transactions still retrieve correctly.

---

# 37. FINAL REQUIRED REPORT

Before editing:

```text
Current transaction type:
Current 1024-byte restriction location:
Current Solana SDK version:
Current wallet adapter version:
V1 SDK support:
V1 wallet support:
Devnet v1 availability:
Files requiring changes:
```

After editing:

```text
V1 transaction construction:
PASS/FAIL

4096-byte limit:
PASS/FAIL

Actual Devnet v1 transaction:
PASS/FAIL

Wallet signing:
PASS/FAIL

Large Memo publish:
PASS/FAIL

Large Memo retrieval:
PASS/FAIL

SHA-256 verification:
PASS/FAIL

Legacy V2 retrieval:
PASS/FAIL

V0 V2 retrieval:
PASS/FAIL

No Storage Drop:
PASS

Production build:
PASS/FAIL
```

---

# FINAL INSTRUCTION

Do not rewrite HashDrop.

Do not change the V2 Memo protocol.

Do not introduce Storage Drop.

Do not create a fake 4096-byte limit.

Do not merely replace `1024` with `4096`.

Implement genuine Solana v1 transaction support where the installed SDK, wallet, and active Devnet support it.

Use dynamic serialization to determine the exact usable capacity.

Preserve the existing working HashDrop application.

Only the transaction-capacity/version layer should change.
