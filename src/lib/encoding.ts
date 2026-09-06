/**
 * HashDrop UTF-8 Encoding Utilities
 * 
 * Provides Unicode-safe UTF-8 to Base64 encoding and decoding.
 * These utilities ensure proper handling of all Unicode characters,
 * including emojis, non-Latin scripts, and special symbols.
 */

/**
 * Encode a UTF-8 string to Base64
 * Uses TextEncoder to properly convert Unicode to UTF-8 bytes,
 * then encodes those bytes to Base64.
 * 
 * @param text - The UTF-8 string to encode
 * @returns Base64 encoded string
 * 
 * @example
 * utf8ToBase64('Hello 🌍') // Returns Base64 representation of UTF-8 bytes
 * utf8ToBase64('বাংলা') // Works with Bengali characters
 * utf8ToBase64('你好世界') // Works with Chinese characters
 */
export function utf8ToBase64(text: string): string {
  // Encode text to UTF-8 bytes
  const bytes = new TextEncoder().encode(text);
  
  // Convert bytes to binary string for btoa
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  // Encode binary string to Base64
  return btoa(binary);
}

/**
 * Decode a Base64 string to UTF-8 text
 * Uses atob to decode Base64 to binary, then TextDecoder
 * to convert UTF-8 bytes back to a Unicode string.
 * 
 * @param base64 - The Base64 string to decode
 * @returns Decoded UTF-8 string
 * 
 * @example
 * base64ToUtf8('SGVsbG8g8J+Mj8=') // Returns 'Hello 🌍'
 * base64ToUtf8('0JfQsNC00L7QstC+0L3RgNCw0Y8=') // Returns Bengali text
 */
export function base64ToUtf8(base64: string): string {
  // Decode Base64 to binary string
  const binary = atob(base64);
  
  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  // Decode UTF-8 bytes to string
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Encode a UTF-8 string to Uint8Array (raw bytes)
 * 
 * @param text - The UTF-8 string to convert
 * @returns Uint8Array containing the UTF-8 bytes
 */
export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Decode Uint8Array to UTF-8 string
 * 
 * @param bytes - The UTF-8 bytes to decode
 * @returns Decoded UTF-8 string
 */
export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Encode raw bytes to Base64 string
 * Used for binary data that is not valid UTF-8 (e.g., encryption keys)
 *
 * @param bytes - Raw bytes to encode
 * @returns Base64 encoded string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode Base64 string to raw bytes
 * Used for binary data that is not valid UTF-8 (e.g., encryption keys)
 *
 * @param base64 - Base64 encoded string
 * @returns Raw bytes
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}