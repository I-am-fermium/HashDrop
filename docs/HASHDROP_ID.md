# HashDrop ID

The HashDrop ID is the deterministic identifier for a publication.

## Format

```
hd_<hash_prefix>_<creator_short>_<size_hash>
```

Example: `hd_e0ba1ac4_Amy4Tej8_g`

## Generation Algorithm

The HashDrop ID is generated from:

1. **Content Hash**: First 8 characters of SHA-256 hash
2. **Creator**: First 8 characters of wallet public key (Base58)
3. **Size Hash**: Content size in base-36

```typescript
function generateHashDropId(hash: string, creator: string, contentSize: number): string {
  const sizeHash = Math.abs(contentSize).toString(36);
  const creatorShort = creator.slice(0, 8);
  return `hd_${hash.slice(0, 8)}_${creatorShort}_${sizeHash}`;
}
```

## Requirements

- **Deterministic**: Same input always produces same ID
- **Collision-resistant**: Based on SHA-256 hash
- **Derived from protocol-defined inputs**: Content hash, creator, size
- **Independent of mutable UI state**: Generated from immutable data
- **Serialized using explicit byte ordering**: UTF-8 encoding

## Usage

The HashDrop ID serves as:

1. **Human-readable identifier**: Easy to share and reference
2. **Content locator**: Combined with transaction signature for retrieval
3. **Verification anchor**: Used to verify content authenticity

## Verification

When retrieving content:

1. Fetch transaction by signature
2. Extract HashDrop ID from memo payload
3. Compare with expected ID
4. Verify content hash matches

## Current Implementation

Location: `src/lib/content.ts`

The ID is generated during content processing and included in all V3 payloads:

```
HASHDROP|v3|<MODE>|...
```

## V3 PUBLIC Format

The complete Public mode payload format is:

```
HASHDROP|v3|PUBLIC|<hashDropId>|<sha256>|<mimeType>|<contentSize>|<base64Content>
```

Where:
- `v3` - Protocol version
- `PUBLIC` - Mode identifier
- `<hashDropId>` - Deterministic identifier
- `<sha256>` - SHA-256 hash of content
- `<mimeType>` - Content type (e.g., text/plain)
- `<length>` - Content length in bytes
- `<base64Content>` - Base64-encoded content