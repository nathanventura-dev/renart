import { describe, it, expect } from 'vitest';
import { createEditorStore, RedactionAnnotation } from '../src/state/editorStore';
import { AnonymizedLine } from '../src/utils/textAnonymizer';

describe('Smart Text Store Integration', () => {
  it('allows setting redactionMode to smart-text and updates store state', () => {
    const store = createEditorStore();
    expect(store.getState().redactionMode).toBe('rect');

    store.setRedactionMode('smart-text');
    expect(store.getState().redactionMode).toBe('smart-text');
  });

  it('adds and updates smart-text redaction annotation with lines and colors', () => {
    const store = createEditorStore();

    const sampleLines: AnonymizedLine[] = [
      {
        text: 'Valor R$ 100,00',
        replacementText: 'Valor R$ 450,80',
        x: 10,
        y: 10,
        width: 120,
        height: 20,
        words: [
          {
            text: 'Valor',
            originalText: 'Valor',
            replacementText: 'Valor',
            tokenType: 'word',
            x: 10,
            y: 10,
            width: 40,
            height: 20,
          },
          {
            text: 'R$ 100,00',
            originalText: 'R$ 100,00',
            replacementText: 'R$ 450,80',
            tokenType: 'currency',
            x: 55,
            y: 10,
            width: 75,
            height: 20,
          },
        ],
      },
    ];

    const ann: RedactionAnnotation = {
      id: 'smart-1',
      type: 'redaction',
      mode: 'smart-text',
      x: 10,
      y: 10,
      width: 140,
      height: 30,
      bgColor: '#ffffff',
      textColor: '#1e293b',
      lines: sampleLines,
    };

    store.addAnnotation(ann);
    expect(store.getState().annotations).toHaveLength(1);
    const stored = store.getState().annotations[0] as RedactionAnnotation;
    expect(stored.mode).toBe('smart-text');
    expect(stored.bgColor).toBe('#ffffff');
    expect(stored.lines).toHaveLength(1);
    expect(stored.lines![0].replacementText).toBe('Valor R$ 450,80');
  });

  it('regenerates synthetic text on regenerateSmartText action with undo history', () => {
    const store = createEditorStore();

    const sampleLines: AnonymizedLine[] = [
      {
        text: 'Cliente Carlos Silva',
        replacementText: 'Cliente Marcos Costa',
        x: 20,
        y: 20,
        width: 180,
        height: 22,
        words: [
          {
            text: 'Cliente',
            originalText: 'Cliente',
            replacementText: 'Cliente',
            tokenType: 'word',
            x: 20,
            y: 20,
            width: 50,
            height: 22,
          },
          {
            text: 'Carlos',
            originalText: 'Carlos',
            replacementText: 'Marcos',
            tokenType: 'word',
            x: 75,
            y: 20,
            width: 50,
            height: 22,
          },
          {
            text: 'Silva',
            originalText: 'Silva',
            replacementText: 'Costa',
            tokenType: 'word',
            x: 130,
            y: 20,
            width: 70,
            height: 22,
          },
        ],
      },
    ];

    const ann: RedactionAnnotation = {
      id: 'smart-2',
      type: 'redaction',
      mode: 'smart-text',
      x: 20,
      y: 20,
      width: 180,
      height: 22,
      bgColor: '#f1f5f9',
      textColor: '#0f172a',
      lines: sampleLines,
    };

    store.addAnnotation(ann);
    const initialText = (store.getState().annotations[0] as RedactionAnnotation).lines![0].replacementText;

    // Aciona a regeneração
    store.regenerateSmartText('smart-2');

    const updated = store.getState().annotations[0] as RedactionAnnotation;
    expect(updated.lines![0].replacementText).toBeDefined();

    // Undo restaura o texto inicial
    expect(store.canUndo()).toBe(true);
    store.undo();
    const restored = store.getState().annotations[0] as RedactionAnnotation;
    expect(restored.lines![0].replacementText).toBe(initialText);
  });
});
