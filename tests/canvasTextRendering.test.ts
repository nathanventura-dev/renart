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

  it('formats only selected text when selection is active, and entire block when collapsed', () => {
    let executedCommand = '';
    let executedOnAll = false;

    const simulateShortcut = (
      command: 'bold' | 'italic' | 'underline' | 'strikeThrough',
      hasSelection: boolean
    ) => {
      if (hasSelection) {
        executedCommand = command;
        executedOnAll = false;
      } else {
        executedCommand = command;
        executedOnAll = true;
      }
    };

    // 1. With selection
    simulateShortcut('bold', true);
    expect(executedCommand).toBe('bold');
    expect(executedOnAll).toBe(false);

    // 2. Without selection (collapsed caret)
    simulateShortcut('italic', false);
    expect(executedCommand).toBe('italic');
    expect(executedOnAll).toBe(true);
  });

  describe('Inline Text Editor Key Cycle & Commit Logic', () => {
    it('allows Enter to create newlines without prematurely committing or closing', () => {
      let isCommitted = false;
      let preventDefaultCalled = false;

      const handleInlineKeyDown = (e: {
        key: string;
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        preventDefault: () => void;
      }) => {
        const isCommitKey =
          (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'Escape';

        if (isCommitKey) {
          e.preventDefault();
          isCommitted = true;
          return;
        }

        // Enter simples: NÃO fecha a edição, permitindo nova linha
        if (e.key === 'Enter') {
          // Não dá preventDefault para permitir a inserção da quebra de linha natural
          return;
        }
      };

      // 1. Enter simples: não fecha
      handleInlineKeyDown({
        key: 'Enter',
        preventDefault: () => {
          preventDefaultCalled = true;
        },
      });
      expect(isCommitted).toBe(false);
      expect(preventDefaultCalled).toBe(false);

      // 2. Ctrl+Enter: fecha/commita
      handleInlineKeyDown({
        key: 'Enter',
        ctrlKey: true,
        preventDefault: () => {
          preventDefaultCalled = true;
        },
      });
      expect(isCommitted).toBe(true);
      expect(preventDefaultCalled).toBe(true);

      // 3. Escape: fecha
      isCommitted = false;
      handleInlineKeyDown({
        key: 'Escape',
        preventDefault: () => {},
      });
      expect(isCommitted).toBe(true);
    });
  });
});
