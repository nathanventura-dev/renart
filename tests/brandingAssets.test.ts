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
  it('icon.png artwork fills about 86% of the canvas (880 of 1024px) with a transparent margin', () => {
    const img = decodeRgba(path.resolve(__dirname, '../src-tauri/icons/icon.png'));
    const row = Math.floor(img.height / 2);
    const alphaAt = (x: number) => img.px[(row * img.width + x) * 4 + 3];
    const firstOpaque = Array.from({ length: img.width }, (_, x) => x).find((x) => alphaAt(x) === 255) as number;
    const margin = (firstOpaque / img.width) * 1024;
    expect(margin).toBeGreaterThanOrEqual(68);
    expect(margin).toBeLessThanOrEqual(76);
    expect(alphaAt(0)).toBe(0);
  });
});
