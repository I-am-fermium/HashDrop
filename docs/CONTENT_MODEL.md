# Content Model

## V1 supported content

HashDrop V1 supports small text and source-code content.

A content record should have an explicit media/content type and optional programming-language metadata.

## Byte-first rule

Hashes and sizes operate on the exact bytes that will be stored on-chain, not on characters or rendered text.

The browser must establish a deterministic encoding before hashing and publishing.

## Supported Content Types

| MIME Type | Description |
|-----------|-------------|
| text/plain | Plain text |
| text/javascript | JavaScript |
| text/typescript | TypeScript |
| text/html | HTML |
| text/css | CSS |
| application/json | JSON |
| text/markdown | Markdown |

## Validation

Reject:

- unsupported content types;
- empty content if the protocol disallows it;
- assets exceeding the V1 limit;
- malformed data that cannot be represented by the protocol.

The precise policy must be implemented consistently between client and program.

## Content Size Limits

### Memo Drop (Current - v0)
- **Max Transaction Size**: 1232 bytes
- **Effective Content**: ~800 bytes (after base64 encoding)
- **Recommendation**: Keep content under 700 bytes for safety

### Memo Drop (Target - v1)
- **Max Transaction Size**: 4096 bytes
- **Effective Content**: ~2800 bytes (after base64 encoding)
- **Status**: Ready when Phantom adds v1 signing support

## Encoding

Content is encoded as:

1. UTF-8 bytes via `TextEncoder`
2. Base64 encoding for memo payload
3. SHA-256 hash for verification

## Unicode Support

The application correctly handles:

- ASCII characters
- Emoji (🚀)
- Accented characters (é, ü, ñ)
- Non-Latin scripts (你好, مرحبا)
- Mixed Unicode content

**Important**: Use UTF-8 byte length, not JavaScript `string.length`.