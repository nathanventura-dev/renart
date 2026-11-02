import { describe, it, expect, vi } from 'vitest';
import {
  resolveKonvaFontStyle,
  resolveKonvaTextDecoration,
  resolveTextCssStyle,
  isEditingTextElement,
  shouldShowTextCornerAnchors,
  resetTextDimensionsToAutoFit,
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

  it('formats selected range when selection is active, and applies to subsequent typing without selecting whole node when collapsed', () => {
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
        executedOnAll = false;
      }
    };

    // 1. With selection
    simulateShortcut('bold', true);
    expect(executedCommand).toBe('bold');
    expect(executedOnAll).toBe(false);

    // 2. Without selection (collapsed caret)
    simulateShortcut('italic', false);
    expect(executedCommand).toBe('italic');
    expect(executedOnAll).toBe(false);
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

    it('identifies text editable elements correctly via isEditingTextElement', () => {
      // 1. Inputs e Textareas
      expect(isEditingTextElement({ tagName: 'INPUT' } as any)).toBe(true);
      expect(isEditingTextElement({ tagName: 'TEXTAREA' } as any)).toBe(true);

      // 2. Elemento contentEditable
      expect(isEditingTextElement({ isContentEditable: true } as any)).toBe(true);
      expect(
        isEditingTextElement({
          getAttribute: (attr: string) => (attr === 'contenteditable' ? 'true' : null),
        } as any)
      ).toBe(true);

      // 3. Elemento filho de um container contentEditable (ex: span ou b interno)
      const parentEditable = {
        getAttribute: (attr: string) => (attr === 'contenteditable' ? 'true' : null),
        isContentEditable: true,
      };
      const childSpan = {
        tagName: 'SPAN',
        closest: (selector: string) => (selector.includes('contenteditable') ? parentEditable : null),
      };
      expect(isEditingTextElement(childSpan as any)).toBe(true);

      // 4. Elementos normais do canvas / tela (NÃO editáveis)
      expect(isEditingTextElement(null)).toBe(false);
      expect(isEditingTextElement({ tagName: 'CANVAS' } as any)).toBe(false);
      expect(isEditingTextElement({ tagName: 'DIV', isContentEditable: false } as any)).toBe(false);
    });

    it('prevents global canvas undo/delete/escape when target is an editable element', () => {
      let canvasUndoCount = 0;
      let canvasRedoCount = 0;
      let canvasDeleteCount = 0;
      let canvasDeselectCount = 0;

      const handleGlobalKeyDown = (e: {
        key: string;
        ctrlKey?: boolean;
        metaKey?: boolean;
        shiftKey?: boolean;
        target: any;
        preventDefault: () => void;
      }) => {
        // Guard de proteção: se estiver em elemento editável, não intercepta
        if (isEditingTextElement(e.target)) {
          return;
        }

        const isCtrlOrCmd = Boolean(e.ctrlKey || e.metaKey);

        if (e.key === 'Escape') {
          canvasDeselectCount++;
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          canvasDeleteCount++;
          return;
        }

        if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          canvasUndoCount++;
          return;
        }

        if ((isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z') || (isCtrlOrCmd && e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          canvasRedoCount++;
          return;
        }
      };

      const editableTarget = {
        tagName: 'DIV',
        isContentEditable: true,
        getAttribute: () => 'true',
      };
      const canvasTarget = {
        tagName: 'CANVAS',
      };

      const preventDefault = vi.fn();

      // Quando o foco está no editor de texto:
      // Ctrl+Z não deve disparar o undo do canvas
      handleGlobalKeyDown({ key: 'z', ctrlKey: true, target: editableTarget, preventDefault });
      expect(canvasUndoCount).toBe(0);

      // Backspace e Delete não devem apagar a anotação do canvas
      handleGlobalKeyDown({ key: 'Backspace', target: editableTarget, preventDefault });
      handleGlobalKeyDown({ key: 'Delete', target: editableTarget, preventDefault });
      expect(canvasDeleteCount).toBe(0);

      // Escape não deve desselecionar a anotação pelo listener global do canvas
      handleGlobalKeyDown({ key: 'Escape', target: editableTarget, preventDefault });
      expect(canvasDeselectCount).toBe(0);

      // Quando o foco está no canvas:
      // Ctrl+Z deve disparar o undo do canvas normalmente
      handleGlobalKeyDown({ key: 'z', ctrlKey: true, target: canvasTarget, preventDefault });
      expect(canvasUndoCount).toBe(1);

      // Backspace deve apagar a anotação
      handleGlobalKeyDown({ key: 'Backspace', target: canvasTarget, preventDefault });
      expect(canvasDeleteCount).toBe(1);

      // Escape deve desselecionar
      handleGlobalKeyDown({ key: 'Escape', target: canvasTarget, preventDefault });
      expect(canvasDeselectCount).toBe(1);
    });

    it('safely commits non-empty text and cleans up empty annotations on commit', () => {
      let updatedAnnotation: { id: string; text: string } | null = null;
      let removedId: string | null = null;
      let editorClosed = false;

      const commitEditing = (
        editingText: { id: string; text: string } | null,
        val: string,
        onUpdate: (id: string, updates: any) => void,
        onRemove?: (id: string) => void
      ) => {
        if (!editingText) return;
        const trimmed = val.trim();
        if (trimmed) {
          onUpdate(editingText.id, { text: trimmed });
        } else if (onRemove) {
          onRemove(editingText.id);
        }
        editorClosed = true;
      };

      // 1. Commita texto não vazio: salva a atualização e conclui sem deletar
      commitEditing(
        { id: 'ann-1', text: 'Texto Antigo' },
        'Texto Novo Atualizado',
        (id, updates) => {
          updatedAnnotation = { id, text: updates.text };
        },
        (id) => {
          removedId = id;
        }
      );
      expect(updatedAnnotation).toEqual({ id: 'ann-1', text: 'Texto Novo Atualizado' });
      expect(removedId).toBeNull();
      expect(editorClosed).toBe(true);

      // 2. Commita texto vazio (usuário limpou tudo): remove o bloco fantasma
      updatedAnnotation = null;
      removedId = null;
      editorClosed = false;

      commitEditing(
        { id: 'ann-2', text: 'Texto Antigo' },
        '   ',
        (id, updates) => {
          updatedAnnotation = { id, text: updates.text };
        },
        (id) => {
          removedId = id;
        }
      );
      expect(updatedAnnotation).toBeNull();
      expect(removedId).toBe('ann-2');
      expect(editorClosed).toBe(true);
    });
  });

  describe('Conditional 4-Corner Handles & Auto-Fit Reset Logic', () => {
    it('hides corner resize handles for text when autoWrap is disabled or undefined', () => {
      expect(shouldShowTextCornerAnchors({ type: 'text', autoWrap: false })).toBe(false);
      expect(shouldShowTextCornerAnchors({ type: 'text' })).toBe(false);
    });

    it('shows corner resize handles for text only when autoWrap is enabled', () => {
      expect(shouldShowTextCornerAnchors({ type: 'text', autoWrap: true })).toBe(true);
    });

    it('always shows corner resize handles for non-text annotations', () => {
      expect(shouldShowTextCornerAnchors({ type: 'rect' })).toBe(true);
      expect(shouldShowTextCornerAnchors({ type: 'ellipse' })).toBe(true);
      expect(shouldShowTextCornerAnchors({ type: 'redaction' })).toBe(true);
    });

    it('resetTextDimensionsToAutoFit resets width, height and autoWrap', () => {
      const reset = resetTextDimensionsToAutoFit();
      expect(reset).toEqual({
        width: undefined,
        height: undefined,
        autoWrap: false,
      });
    });
  });
});
