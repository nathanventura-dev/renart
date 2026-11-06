import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getMascotSrc } from '../src/theme/mascot';

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
});
