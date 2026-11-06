import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { decodeRgba } from './helpers/png';

describe('Branding Assets', () => {
  it('has both dark and light mascot images in docs/assets/', () => {
    const darkPath = path.resolve(__dirname, '../docs/assets/renart-mascot-dark.jpg');
    const lightPath = path.resolve(__dirname, '../docs/assets/renart-mascot-light.jpg');

    expect(fs.existsSync(darkPath)).toBe(true);
    expect(fs.existsSync(lightPath)).toBe(true);

    const darkStats = fs.statSync(darkPath);
    const lightStats = fs.statSync(lightPath);

    expect(darkStats.size).toBeGreaterThan(1000);
    expect(lightStats.size).toBeGreaterThan(1000);
  });
});

describe('Tauri bundle icons', () => {
  it('every icon referenced in tauri.conf.json exists in src-tauri/', () => {
    const confPath = path.resolve(__dirname, '../src-tauri/tauri.conf.json');
    const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
    const icons: string[] = conf.bundle.icon;
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(fs.existsSync(path.resolve(__dirname, '../src-tauri', icon)), icon).toBe(true);
    }
  });
});

describe('macOS icon grid', () => {
  it('icon.png artwork fills the standard 80.5% of the canvas (824 of 1024px, as measured on Calculator, Notes and Preview)', () => {
    const img = decodeRgba(path.resolve(__dirname, '../src-tauri/icons/icon.png'));
    const row = Math.floor(img.height / 2);
    const alphaAt = (x: number) => img.px[(row * img.width + x) * 4 + 3];
    const firstOpaque = Array.from({ length: img.width }, (_, x) => x).find((x) => alphaAt(x) === 255) as number;
    const margin = (firstOpaque / img.width) * 1024;
    expect(margin).toBeGreaterThanOrEqual(97);
    expect(margin).toBeLessThanOrEqual(103);
    expect(alphaAt(0)).toBe(0);
  });

  it('icon.png body is charcoal (not pure black) with a visible rim, so it stands out on a near-black Dock', () => {
    const img = decodeRgba(path.resolve(__dirname, '../src-tauri/icons/icon.png'));
    const row = Math.floor(img.height / 2);
    const rgbSum = (x: number) => {
      const o = (row * img.width + x) * 4;
      return img.px[o] + img.px[o + 1] + img.px[o + 2];
    };
    const first = Array.from({ length: img.width }, (_, x) => x).find((x) => img.px[(row * img.width + x) * 4 + 3] === 255) as number;
    const k = img.width / 1024;
    expect(rgbSum(first + Math.round(3 * k))).toBeGreaterThanOrEqual(200); // aro claro na borda
    expect(rgbSum(first + Math.round(60 * k))).toBeGreaterThanOrEqual(80); // corpo grafite, mais claro que o Dock (~40)
    expect(rgbSum(first + Math.round(60 * k))).toBeLessThanOrEqual(170); // ainda escuro
  });
});
