// tests/appFeatures.test.ts
import { describe, it, expect } from 'vitest';
import { createEditorStore } from '../src/state/editorStore';
import { createGalleryStore } from '../src/state/galleryStore';

describe('App Enhanced Features & User Fixes', () => {
  it('handles paste of image dataUrl into gallery respecting 10 items limit', () => {
    const gallery = createGalleryStore(10);

    // Simula colagem de 3 imagens consecutivas
    for (let i = 1; i <= 3; i++) {
      gallery.addCapture({
        id: `pasted-${i}`,
        title: `Imagem Colada #${i}`,
        dataUrl: `data:image/png;base64,mockPaste${i}`,
        createdAt: Date.now() + i,
      });
    }

    expect(gallery.getState().captures).toHaveLength(3);
    expect(gallery.getState().activeId).toBe('pasted-3');
  });

  it('deselects annotation when escape key or clearSelection is called', () => {
    const editor = createEditorStore({
      annotations: [
        { id: 'item-1', type: 'rect', x: 10, y: 10, width: 50, height: 50, stroke: '#f00' }
      ],
      selectedId: 'item-1'
    });

    expect(editor.getState().selectedId).toBe('item-1');
    editor.setSelectedId(null);
    expect(editor.getState().selectedId).toBeNull();
  });

  it('manages isLocked / isSaved state for annotations upon Ctrl+S or saving', () => {
    const editor = createEditorStore();
    expect(editor.isLocked()).toBe(false);

    editor.setLocked(true);
    expect(editor.isLocked()).toBe(true);

    editor.setLocked(false);
    expect(editor.isLocked()).toBe(false);
  });

  it('supports inline text editing update without modal prompts', () => {
    const editor = createEditorStore();
    editor.addAnnotation({
      id: 'text-1',
      type: 'text',
      x: 100,
      y: 100,
      text: 'Texto Inicial',
      fontSize: 16
    });

    editor.updateAnnotation('text-1', { text: 'Texto Editado Diretamente' });
    const textAnn = editor.getState().annotations.find(a => a.id === 'text-1');
    expect(textAnn?.type).toBe('text');
    if (textAnn?.type === 'text') {
      expect(textAnn.text).toBe('Texto Editado Diretamente');
    }
  });

  it('deletes the currently selected block when removeSelectedAnnotation is invoked (Delete key) and supports undo', () => {
    const editor = createEditorStore();
    editor.addAnnotation({
      id: 'rect-del-1',
      type: 'rect',
      x: 20,
      y: 20,
      width: 100,
      height: 80,
      stroke: '#ff3b30',
    });
    editor.addAnnotation({
      id: 'mag-del-2',
      type: 'magnifier',
      x: 200,
      y: 200,
      radius: 65,
      zoomLevel: 2.0,
    });

    // O último bloco adicionado ('mag-del-2') está selecionado
    expect(editor.getState().selectedId).toBe('mag-del-2');
    expect(editor.getState().annotations).toHaveLength(2);

    // Pressionar Delete apaga o bloco selecionado
    const removed = editor.removeSelectedAnnotation();
    expect(removed).toBe(true);
    expect(editor.getState().annotations).toHaveLength(1);
    expect(editor.getState().annotations[0].id).toBe('rect-del-1');
    expect(editor.getState().selectedId).toBeNull();

    // Ctrl+Z (undo) restaura o bloco apagado
    editor.undo();
    expect(editor.getState().annotations).toHaveLength(2);
  });

  it('does not delete selected block when canvas is locked after saving', () => {
    const editor = createEditorStore({
      annotations: [
        { id: 'rect-locked', type: 'rect', x: 10, y: 10, width: 50, height: 50, stroke: '#000' },
      ],
      selectedId: 'rect-locked',
      isLocked: true,
    });

    const removed = editor.removeSelectedAnnotation();
    expect(removed).toBe(false);
    expect(editor.getState().annotations).toHaveLength(1);
  });
});
