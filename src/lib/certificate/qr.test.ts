import { generateQrMatrix, generateQrSvg } from './qr';

describe('QR Code generator (qr.ts)', () => {
  it('generates a valid binary matrix for a URL', () => {
    const matrix = generateQrMatrix('https://hashdrop.io/viewer');
    expect(matrix).toBeDefined();
    expect(matrix.length).toBeGreaterThan(20);
    expect(matrix.length).toBe(matrix[0].length); // square
  });

  it('generates an SVG string with rect and path elements', () => {
    const svg = generateQrSvg('https://hashdrop.io/viewer?network=devnet', 150);
    expect(svg).toContain('<svg');
    expect(svg).toContain('width="150"');
    expect(svg).toContain('height="150"');
    expect(svg).toContain('<rect width="100%" height="100%" fill="#ffffff"/>');
    expect(svg).toContain('<path d="');
  });

  it('throws an error if data exceeds capacity', () => {
    const huge = 'a'.repeat(500);
    expect(() => generateQrMatrix(huge)).toThrow(/too long/);
  });
});
