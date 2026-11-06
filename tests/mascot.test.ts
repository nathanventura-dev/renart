import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getMascotSrc } from '../src/theme/mascot';
import { RENART_THEME } from '../src/theme/colors';
import { decodeRgba } from './helpers/png';

/** Mediana RGB do núcleo das linhas da raposa (exclui pixels de borda misturados com o fundo). */
function medianOrange(file: string): number[] {
  const { px } = decodeRgba(path.resolve(__dirname, '../public', file));
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
