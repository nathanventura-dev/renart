import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RENART_THEME } from '../src/theme/colors';

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
});
