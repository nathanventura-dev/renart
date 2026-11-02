import { describe, it, expect } from 'vitest';
import { createEditorStore, TextAnnotation } from '../src/state/editorStore';

describe('Editor Store Text Formatting', () => {
  it('initializes text formatting options with default values', () => {
    const store = createEditorStore();
    const state = store.getState();

    expect(state.isBold).toBe(false);
    expect(state.isItalic).toBe(false);
    expect(state.isUnderline).toBe(false);
    expect(state.isStrikethrough).toBe(false);
    expect(state.textAlign).toBe('left');
    expect(state.hasBackground).toBe(false);
  });

  it('toggles global style options when no annotation is selected', () => {
    const store = createEditorStore();

    store.toggleBold();
    expect(store.getState().isBold).toBe(true);
    store.toggleBold();
    expect(store.getState().isBold).toBe(false);

    store.toggleItalic();
    expect(store.getState().isItalic).toBe(true);

    store.toggleUnderline();
    expect(store.getState().isUnderline).toBe(true);

    store.toggleStrikethrough();
    expect(store.getState().isStrikethrough).toBe(true);

    store.setTextAlign('center');
    expect(store.getState().textAlign).toBe('center');

    store.setTextAlign('right');
    expect(store.getState().textAlign).toBe('right');

    store.toggleBackground();
    expect(store.getState().hasBackground).toBe(true);
  });

  it('updates selected text annotation formatting and records undo/redo', () => {
    const store = createEditorStore();
    const textAnn: TextAnnotation = {
      id: 'text-1',
      type: 'text',
      text: 'Texto de Exemplo',
      fontSize: 18,
      fontFamily: 'Arial',
      x: 50,
      y: 50,
      isBold: false,
      textAlign: 'left',
      hasBackground: false,
    };

    store.addAnnotation(textAnn);
    store.setSelectedIds(['text-1']);

    // Toggle bold on selected annotation
    store.toggleBold();
    const updated = store.getState().annotations[0] as TextAnnotation;
    expect(updated.isBold).toBe(true);
    expect(store.getState().isBold).toBe(true);

    // Toggle underline on selected annotation
    store.toggleUnderline();
    const updatedUnderline = store.getState().annotations[0] as TextAnnotation;
    expect(updatedUnderline.isUnderline).toBe(true);

    // Change alignment
    store.setTextAlign('center');
    const updatedAlign = store.getState().annotations[0] as TextAnnotation;
    expect(updatedAlign.textAlign).toBe('center');

    // Toggle background
    store.toggleBackground();
    const updatedBg = store.getState().annotations[0] as TextAnnotation;
    expect(updatedBg.hasBackground).toBe(true);

    // Undo restores previous states
    expect(store.canUndo()).toBe(true);
    store.undo(); // undo toggleBackground
    expect((store.getState().annotations[0] as TextAnnotation).hasBackground).toBe(false);

    store.undo(); // undo setTextAlign
    expect((store.getState().annotations[0] as TextAnnotation).textAlign).toBe('left');
  });

  it('synchronizes global text styling state when selecting a formatted text annotation', () => {
    const store = createEditorStore();
    const textAnn: TextAnnotation = {
      id: 'text-custom',
      type: 'text',
      text: 'Título Destaque',
      fontSize: 24,
      fontFamily: 'Georgia',
      x: 100,
      y: 100,
      isBold: true,
      isItalic: true,
      isUnderline: true,
      isStrikethrough: false,
      textAlign: 'center',
      hasBackground: true,
    };

    store.addAnnotation(textAnn);
    expect(store.getState().isBold).toBe(false);

    store.setSelectedIds(['text-custom']);
    expect(store.getState().isBold).toBe(true);
    expect(store.getState().isItalic).toBe(true);
    expect(store.getState().isUnderline).toBe(true);
    expect(store.getState().isStrikethrough).toBe(false);
    expect(store.getState().textAlign).toBe('center');
    expect(store.getState().hasBackground).toBe(true);
  });
});
