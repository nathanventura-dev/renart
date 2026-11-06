import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RENART_THEME, LIGHT_PALETTE, DARK_PALETTE } from '../src/theme/colors';

describe('RenArt Theme Colors', () => {
  it('exports expected fox orange palette values', () => {
    expect(RENART_THEME.primary).toBe('#d3551d');
    expect(RENART_THEME.primaryHover).toBe('#e66a2d');
    expect(RENART_THEME.primaryTint).toBe('rgba(211, 85, 29, 0.12)');
    expect(RENART_THEME.primaryBorder).toBe('rgba(211, 85, 29, 0.3)');
    expect(RENART_THEME.galleryActiveBg).toBe('rgba(211, 85, 29, 0.08)');
  });

  it('does not contain lingering secondary blue (#0078d4) in CanvasEditor.tsx', () => {
    const canvasEditorPath = path.resolve(__dirname, '../src/components/CanvasEditor.tsx');
    const content = fs.readFileSync(canvasEditorPath, 'utf-8');
    expect(content).not.toContain('#0078d4');
  });

  it('light and dark palettes expose exactly the same keys', () => {
    expect(Object.keys(LIGHT_PALETTE).sort()).toEqual(Object.keys(DARK_PALETTE).sort());
  });

  it('dark palette matches colors measured from Windows Snipping Tool', () => {
    expect(DARK_PALETTE.chrome).toBe('#1a2227');
    expect(DARK_PALETTE.control).toBe('#272f34');
    expect(DARK_PALETTE.popup).toBe('#2b2c2d');
    expect(DARK_PALETTE.border).toBe('#2c3338');
    expect(DARK_PALETTE.textPrimary).toBe('#ffffff');
    expect(DARK_PALETTE.textSecondary).toBe('#c5c5c5');
    expect(DARK_PALETTE.workspace).toBe('#121211');
  });

  it('light palette keeps current interface colors', () => {
    expect(LIGHT_PALETTE.chrome).toBe('#ffffff');
    expect(LIGHT_PALETTE.border).toBe('#e5e5e7');
    expect(LIGHT_PALETTE.textMuted).toBe('#86868b');
    expect(LIGHT_PALETTE.workspace).toBe('#e5e5e7');
  });

  it('selected tool highlight is distinguishable from the tool group background', () => {
    expect(LIGHT_PALETTE.controlActive).not.toBe(LIGHT_PALETTE.control);
    expect(DARK_PALETTE.controlActive).not.toBe(DARK_PALETTE.control);
    expect(DARK_PALETTE.controlActive).not.toBe(DARK_PALETTE.hover);
  });

  it('light palette keeps the original fox orange with white text on it', () => {
    expect(LIGHT_PALETTE.primary).toBe(RENART_THEME.primary);
    expect(LIGHT_PALETTE.primaryHover).toBe(RENART_THEME.primaryHover);
    expect(LIGHT_PALETTE.primaryTint).toBe(RENART_THEME.primaryTint);
    expect(LIGHT_PALETTE.onPrimary).toBe('#ffffff');
  });

  it('dark palette uses a lighter orange with dark text on it', () => {
    expect(DARK_PALETTE.primary).toBe('#d79373');
    expect(DARK_PALETTE.primaryHover).toBe('#dca287');
    expect(DARK_PALETTE.onPrimary).toBe('#1a1a1a');
  });

  it('dark orange keeps readable contrast (>=3:1 on chrome, >=4.5:1 for text on it)', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    expect(ratio(DARK_PALETTE.primary, DARK_PALETTE.chrome)).toBeGreaterThanOrEqual(3);
    expect(ratio(DARK_PALETTE.onPrimary, DARK_PALETTE.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
