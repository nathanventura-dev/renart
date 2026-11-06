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
});
