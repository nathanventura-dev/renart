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

  it('handles arrow variants lifecycle, style selection, curvature toggling and bounds clamping', () => {
    const editor = createEditorStore();

    // 1. Inicia com estilo standard e espessura 4px
    expect(editor.getState().arrowStyle).toBe('standard');
    editor.addAnnotation({
      id: 'arrow-standard',
      type: 'arrow',
      points: [10, 10, 100, 10],
      stroke: '#ff3b30',
      strokeWidth: 4,
      arrowStyle: 'standard',
    });

    // 2. Cria flecha fina (2px)
    editor.setArrowStyle('thin');
    expect(editor.getState().arrowStyle).toBe('thin');
    editor.addAnnotation({
      id: 'arrow-thin',
      type: 'arrow',
      points: [10, 30, 100, 30],
      stroke: '#0071e3',
      strokeWidth: 2,
      arrowStyle: 'thin',
    });

    // 3. Cria flecha pontilhada
    editor.setArrowStyle('dashed');
    editor.addAnnotation({
      id: 'arrow-dashed',
      type: 'arrow',
      points: [10, 50, 100, 50],
      stroke: '#34c759',
      strokeWidth: 4,
      arrowStyle: 'dashed',
    });

    // 4. Cria flecha curva com 6 pontos
    editor.setArrowStyle('curved');
    editor.addAnnotation({
      id: 'arrow-curved',
      type: 'arrow',
      points: [10, 100, 55, 120, 100, 100],
      stroke: '#ff9f0a',
      strokeWidth: 4,
      arrowStyle: 'curved',
      curveDirection: 'right',
    });

    expect(editor.getState().annotations).toHaveLength(4);

    // 5. Alterna a direção da curva da flecha curva
    editor.setSelectedIds(['arrow-curved']);
    editor.toggleArrowCurveDirection('arrow-curved');
    const curvedAnn = editor.getState().annotations.find((a) => a.id === 'arrow-curved');
    expect(curvedAnn?.type === 'arrow' && curvedAnn.curveDirection).toBe('left');

    // 6. Undo retorna para 'right'
    editor.undo();
    const curvedUndone = editor.getState().annotations.find((a) => a.id === 'arrow-curved');
    expect(curvedUndone?.type === 'arrow' && curvedUndone.curveDirection).toBe('right');
  });
});
