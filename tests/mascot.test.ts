import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { getMascotSrc } from '../src/theme/mascot';
import { RENART_THEME } from '../src/theme/colors';

/** Decodifica PNG RGBA 8 bits não entrelaçado (formato gerado pelo Pillow). */
function decodeRgba(file: string) {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public', file));
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    if (buf.subarray(o + 4, o + 8).toString('ascii') === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const add = [0, a, b, (a + b) >> 1, paeth][filter];
      px[y * stride + x] = (cur + add) & 255;
    }
  }
  return { width, height, px };
}

/** Mediana RGB do núcleo das linhas da raposa (exclui pixels de borda misturados com o fundo). */
function medianOrange(file: string): number[] {
  const { px } = decodeRgba(file);
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (a === 255 && r - b >= 170 && r - g > 100) { rs.push(r); gs.push(g); bs.push(b); }
  }
  expect(rs.length).toBeGreaterThan(500);
  const med = (v: number[]) => v.sort((x, y) => x - y)[Math.floor(v.length / 2)];
  return [med(rs), med(gs), med(bs)];
}

function pngHeader(file: string) {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public', file));
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

describe('mascot', () => {
  it('uses the orange fox in the light theme and the cyan fox in the dark theme', () => {
    expect(getMascotSrc('light')).toBe('/mascot-light.png');
    expect(getMascotSrc('dark')).toBe('/mascot-dark.png');
  });

  it.each(['mascot-light.png', 'mascot-dark.png'])('%s is a 256x256 PNG with an alpha channel', (file) => {
    expect(pngHeader(file)).toEqual({ width: 256, height: 256, colorType: 6 });
  });

  it('keeps the cyan source image in docs/assets', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../docs/assets/renart-mascot-cyan.jpg'))).toBe(true);
  });

  it.each(['mascot-light.png', 'mascot-dark.png'])('%s uses exactly the brand orange on the fox lines', (file) => {
    const brand = [1, 3, 5].map((i) => parseInt(RENART_THEME.primary.slice(i, i + 2), 16));
    const median = medianOrange(file);
    median.forEach((c, i) => expect(Math.abs(c - brand[i])).toBeLessThanOrEqual(3));
  });
});
