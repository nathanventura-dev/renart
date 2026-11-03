import { describe, it, expect } from 'vitest';
import { RENART_THEME } from '../src/theme/colors';

describe('RenArt Theme Colors', () => {
  it('exports expected fox orange palette values', () => {
    expect(RENART_THEME.primary).toBe('#d3551d');
    expect(RENART_THEME.primaryHover).toBe('#e66a2d');
    expect(RENART_THEME.primaryTint).toBe('rgba(211, 85, 29, 0.12)');
    expect(RENART_THEME.primaryBorder).toBe('rgba(211, 85, 29, 0.3)');
    expect(RENART_THEME.galleryActiveBg).toBe('rgba(211, 85, 29, 0.08)');
  });
});
