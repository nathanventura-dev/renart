import { describe, it, expect } from 'vitest';
import { createEditorStore, TextAnnotation } from '../src/state/editorStore';

describe('Toolbar and App Text Formatting Integration', () => {
  it('toggles bold, italic, underline, strikethrough on whole annotation when no text is selected', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'text-1',
      type: 'text',
      x: 10,
      y: 10,
      text: 'Exemplo de texto',
      fontSize: 18,
      isBold: false,
    });
    store.setSelectedIds(['text-1']);

    store.toggleBold();
    const annAfterBold = store.getState().annotations.find((a) => a.id === 'text-1') as TextAnnotation;
    expect(annAfterBold?.isBold).toBe(true);

    store.toggleItalic();
    const annAfterItalic = store.getState().annotations.find((a) => a.id === 'text-1') as TextAnnotation;
    expect(annAfterItalic?.isItalic).toBe(true);

    store.toggleUnderline();
    const annAfterUnderline = store.getState().annotations.find((a) => a.id === 'text-1') as TextAnnotation;
    expect(annAfterUnderline?.isUnderline).toBe(true);

    store.toggleStrikethrough();
    const annAfterStrike = store.getState().annotations.find((a) => a.id === 'text-1') as TextAnnotation;
    expect(annAfterStrike?.isStrikethrough).toBe(true);
  });

  it('updates spans in TextAnnotation when whole block style is toggled', () => {
    const store = createEditorStore();
    store.addAnnotation({
      id: 'text-mixed',
      type: 'text',
      x: 10,
      y: 10,
      text: 'Parte 1 Parte 2',
      fontSize: 18,
      isBold: false,
      spans: [
        { text: 'Parte 1', isBold: false },
        { text: ' Parte 2', isBold: true },
      ],
    });
    store.setSelectedIds(['text-mixed']);

    store.toggleBold(); // Toggling bold on the whole block sets isBold: true for all spans
    const ann = store.getState().annotations.find((a) => a.id === 'text-mixed') as TextAnnotation;
    expect(ann?.isBold).toBe(true);
    expect(ann?.spans?.[0].isBold).toBe(true);
    expect(ann?.spans?.[1].isBold).toBe(true);
  });
});
