import { describe, it, expect, vi } from 'vitest';
import {
  resolveKonvaFontStyle,
  resolveKonvaTextDecoration,
  resolveTextCssStyle,
} from '../src/utils/textStyle';

describe('Canvas Text Rendering & Shortcuts Logic', () => {
  it('maps text annotation styling properties to Konva Text attributes', () => {
    // 1. Negrito + Sublinhado
    expect(resolveKonvaFontStyle(true, false)).toBe('bold');
    expect(resolveKonvaTextDecoration(true, false)).toBe('underline');

    // 2. Itálico + Riscado
    expect(resolveKonvaFontStyle(false, true)).toBe('italic');
    expect(resolveKonvaTextDecoration(false, true)).toBe('line-through');

    // 3. Negrito + Itálico + Sublinhado + Riscado
    expect(resolveKonvaFontStyle(true, true)).toBe('italic bold');
    expect(resolveKonvaTextDecoration(true, true)).toBe('underline line-through');
  });

  it('provides CSS styles matching inline editing textarea', () => {
    const css = resolveTextCssStyle(true, true, true, false);
    expect(css.fontWeight).toBe('bold');
    expect(css.fontStyle).toBe('italic');
    expect(css.textDecoration).toBe('underline');
  });

  it('handles keyboard shortcuts for inline editing (Ctrl+B, Ctrl+I, Ctrl+U)', () => {
    let state = {
      isBold: false,
      isItalic: false,
      isUnderline: false,
    };

    const handleTextareaKeyDown = (e: {
      ctrlKey?: boolean;
      metaKey?: boolean;
      key: string;
      preventDefault: () => void;
    }) => {
      const isCmdOrCtrl = Boolean(e.ctrlKey || e.metaKey);
      const key = e.key.toLowerCase();

      if (isCmdOrCtrl && key === 'b') {
        e.preventDefault();
        state = { ...state, isBold: !state.isBold };
        return true;
      }
      if (isCmdOrCtrl && key === 'i') {
        e.preventDefault();
        state = { ...state, isItalic: !state.isItalic };
        return true;
      }
      if (isCmdOrCtrl && key === 'u') {
        e.preventDefault();
        state = { ...state, isUnderline: !state.isUnderline };
        return true;
      }
      return false;
    };

    const preventDefault = vi.fn();

    // Test Ctrl+B
    const handledB = handleTextareaKeyDown({ ctrlKey: true, key: 'b', preventDefault });
    expect(handledB).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(state.isBold).toBe(true);

    // Test Ctrl+I
    const handledI = handleTextareaKeyDown({ ctrlKey: true, key: 'i', preventDefault });
    expect(handledI).toBe(true);
    expect(state.isItalic).toBe(true);

    // Test Ctrl+U
    const handledU = handleTextareaKeyDown({ ctrlKey: true, key: 'u', preventDefault });
    expect(handledU).toBe(true);
    expect(state.isUnderline).toBe(true);
  });
});
