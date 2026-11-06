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
  const alphaAt = (img: ReturnType<typeof decodeRgba>, x: number, y: number) => img.px[(y * img.width + x) * 4 + 3];

  it('icon.png keeps the artwork inside ~80% of the canvas with a transparent margin', () => {
    const img = decodeRgba(path.resolve(__dirname, '../src-tauri/icons/icon.png'));
    const m = (n: number) => Math.round((img.width * n) / 1024);
    expect(alphaAt(img, m(40), m(512))).toBe(0); // margem esquerda
    expect(alphaAt(img, m(512), m(40))).toBe(0); // margem superior
    expect(alphaAt(img, m(150), m(512))).toBe(255); // dentro da arte
    expect(alphaAt(img, m(512), m(512))).toBe(255);
  });
});
