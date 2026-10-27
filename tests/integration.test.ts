// tests/integration.test.ts
import { describe, it, expect } from 'vitest';
import { createGalleryStore } from '../src/state/galleryStore';
import { createEditorStore } from '../src/state/editorStore';

describe('Integration Flow', () => {
  it('coordinates gallery selection with canvas editor state', () => {
    const gallery = createGalleryStore();
    const editor = createEditorStore();

    // 1. Simula captura de tela adicionada à galeria
    gallery.addCapture({
      id: 'capture-001',
      title: 'Captura #1',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      createdAt: Date.now(),
    });

    expect(gallery.getState().activeId).toBe('capture-001');

    // 2. Adiciona anotação de retângulo sobre a captura
    editor.addAnnotation({
      id: 'ann-rect-1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      stroke: '#ff3b30',
      strokeWidth: 3,
    });

    expect(editor.getState().annotations).toHaveLength(1);
    expect(editor.getState().annotations[0].type).toBe('rect');

    // 3. Adiciona anotação de lupa (zoom)
    editor.addAnnotation({
      id: 'ann-mag-1',
      type: 'magnifier',
      x: 60,
      y: 60,
      radius: 40,
      zoomLevel: 2.0,
    });

    expect(editor.getState().annotations).toHaveLength(2);

    // 4. Desfaz a última ação (Undo)
    editor.undo();
    expect(editor.getState().annotations).toHaveLength(1);
    expect(editor.getState().annotations[0].id).toBe('ann-rect-1');

    // 5. Refaz a ação (Redo)
    editor.redo();
    expect(editor.getState().annotations).toHaveLength(2);
  });
});
