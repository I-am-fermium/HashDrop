declare module 'bs58' {
  export function encode(data: Uint8Array | Buffer): string;
  export function decode(str: string): Uint8Array;
}

// Add Solana Kit Address type
declare module '@solana/kit' {
  export type Address = string;
}