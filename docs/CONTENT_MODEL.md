# Content Model

## V1 supported content

HashDrop V1 supports small text and source-code content.

A content record should have an explicit media/content type and optional programming-language metadata.

## Byte-first rule

Hashes and sizes operate on the exact bytes that will be stored on-chain, not on characters or rendered text.

The browser must establish a deterministic encoding before hashing and publishing.

## Validation

Reject:

- unsupported content types;
- empty content if the protocol disallows it;
- assets exceeding the V1 limit;
- malformed data that cannot be represented by the protocol.

The precise policy must be implemented consistently between client and program.
