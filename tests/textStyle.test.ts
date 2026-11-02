import { describe, it, expect } from 'vitest';
import {
  resolveKonvaFontStyle,
  resolveKonvaTextDecoration,
  resolveTextCssStyle,
} from '../src/utils/textStyle';

describe('Text Styling Helpers', () => {
  describe('resolveKonvaFontStyle', () => {
    it('returns normal when neither bold nor italic is active', () => {
      expect(resolveKonvaFontStyle(false, false)).toBe('normal');
      expect(resolveKonvaFontStyle(undefined, undefined)).toBe('normal');
    });

    it('returns bold when only bold is active', () => {
      expect(resolveKonvaFontStyle(true, false)).toBe('bold');
      expect(resolveKonvaFontStyle(true, undefined)).toBe('bold');
    });

    it('returns italic when only italic is active', () => {
      expect(resolveKonvaFontStyle(false, true)).toBe('italic');
      expect(resolveKonvaFontStyle(undefined, true)).toBe('italic');
    });

    it('returns italic bold when both bold and italic are active', () => {
      expect(resolveKonvaFontStyle(true, true)).toBe('italic bold');
    });
  });

  describe('resolveKonvaTextDecoration', () => {
    it('returns empty string when neither underline nor strikethrough is active', () => {
      expect(resolveKonvaTextDecoration(false, false)).toBe('');
      expect(resolveKonvaTextDecoration(undefined, undefined)).toBe('');
    });

    it('returns underline when only underline is active', () => {
      expect(resolveKonvaTextDecoration(true, false)).toBe('underline');
    });

    it('returns line-through when only strikethrough is active', () => {
      expect(resolveKonvaTextDecoration(false, true)).toBe('line-through');
    });

    it('returns underline line-through when both are active', () => {
      expect(resolveKonvaTextDecoration(true, true)).toBe('underline line-through');
    });
  });

  describe('resolveTextCssStyle', () => {
    it('generates correct CSS properties for textarea inline editing', () => {
      const normal = resolveTextCssStyle(false, false, false, false);
      expect(normal).toEqual({
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
      });

      const full = resolveTextCssStyle(true, true, true, true);
      expect(full).toEqual({
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecoration: 'underline line-through',
      });

      const underlineOnly = resolveTextCssStyle(false, false, true, false);
      expect(underlineOnly.textDecoration).toBe('underline');

      const strikethroughOnly = resolveTextCssStyle(false, false, false, true);
      expect(strikethroughOnly.textDecoration).toBe('line-through');
    });
  });
});
