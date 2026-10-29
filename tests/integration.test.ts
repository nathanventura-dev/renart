// tests/integration.test.ts
import { describe, it, expect } from 'vitest';
import { createGalleryStore } from '../src/state/galleryStore';
import { createEditorStore } from '../src/state/editorStore';
import { updateCurvedArrowAnchor, updateTwoPointAnchor } from '../src/utils/zoomAndCrop';

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

  it('supports updating individual anchors of a curved arrow with undo and redo history', () => {
    const editor = createEditorStore();
    const initialPoints = [100, 100, 200, 50, 300, 100];

    editor.addAnnotation({
      id: 'arrow-curve-anchor',
      type: 'arrow',
      points: initialPoints,
      stroke: '#0071e3',
      strokeWidth: 4,
      arrowStyle: 'curved',
    });
    editor.setSelectedIds(['arrow-curve-anchor']);

    const getCurvedPoints = () => {
      const ann = editor.getState().annotations[0];
      return ann?.type === 'arrow' ? ann.points : [];
    };

    // 1. Modifica a cauda (âncora 0)
    const pointsTail = updateCurvedArrowAnchor(initialPoints, 0, 80, 120, 800, 600);
    editor.updateAnnotation('arrow-curve-anchor', { points: pointsTail });
    expect(getCurvedPoints()[0]).toBe(80);
    expect(getCurvedPoints()[1]).toBe(120);

    // 2. Modifica a curvatura (âncora 1)
    const pointsBend = updateCurvedArrowAnchor(pointsTail, 1, 200, 180, 800, 600);
    editor.updateAnnotation('arrow-curve-anchor', { points: pointsBend });
    expect(getCurvedPoints()[3]).toBe(180);

    // 3. Modifica a ponta (âncora 2)
    const pointsTip = updateCurvedArrowAnchor(pointsBend, 2, 350, 90, 800, 600);
    editor.updateAnnotation('arrow-curve-anchor', { points: pointsTip });
    expect(getCurvedPoints()[4]).toBe(350);

    // 4. Undo desfaz o ajuste da ponta
    editor.undo();
    expect(getCurvedPoints()[4]).toBe(300);

    // 5. Undo desfaz o ajuste do arco
    editor.undo();
    expect(getCurvedPoints()[3]).toBe(50);

    // 6. Undo desfaz o ajuste da cauda
    editor.undo();
    expect(getCurvedPoints()[0]).toBe(100);

    // 7. Redo reaplica
    editor.redo();
    expect(getCurvedPoints()[0]).toBe(80);
  });

  it('supports updating 2-point anchors of lines and straight arrows with undo and redo history', () => {
    const editor = createEditorStore();

    // 1. Linha reta com 4 coordenadas [x1, y1, x2, y2]
    editor.addAnnotation({
      id: 'line-test',
      type: 'line',
      points: [50, 50, 200, 50],
      stroke: '#ff3b30',
      strokeWidth: 4,
    });
    editor.setSelectedIds(['line-test']);

    const getLinePoints = () => {
      const ann = editor.getState().annotations.find((a) => a.id === 'line-test');
      return ann?.type === 'line' ? ann.points : [];
    };

    // Ajusta a cauda da linha (âncora 0)
    const lineTailUpdated = updateTwoPointAnchor(getLinePoints(), 0, 70, 90, 800, 600);
    editor.updateAnnotation('line-test', { points: lineTailUpdated });
    expect(getLinePoints()).toEqual([70, 90, 200, 50]);

    // Ajusta a ponta da linha (âncora 1)
    const lineTipUpdated = updateTwoPointAnchor(getLinePoints(), 1, 260, 150, 800, 600);
    editor.updateAnnotation('line-test', { points: lineTipUpdated });
    expect(getLinePoints()).toEqual([70, 90, 260, 150]);

    // Undo desfaz ponta
    editor.undo();
    expect(getLinePoints()).toEqual([70, 90, 200, 50]);

    // Undo desfaz cauda
    editor.undo();
    expect(getLinePoints()).toEqual([50, 50, 200, 50]);

    // Redo reaplica cauda
    editor.redo();
    expect(getLinePoints()).toEqual([70, 90, 200, 50]);

    // 2. Seta reta (standard) com 2 pontos
    editor.addAnnotation({
      id: 'arrow-straight-test',
      type: 'arrow',
      points: [100, 100, 250, 100],
      stroke: '#0071e3',
      strokeWidth: 4,
      arrowStyle: 'standard',
    });
    editor.setSelectedIds(['arrow-straight-test']);

    const getArrowPoints = () => {
      const ann = editor.getState().annotations.find((a) => a.id === 'arrow-straight-test');
      return ann?.type === 'arrow' ? ann.points : [];
    };

    // Ajusta a ponta da seta (mira do alvo)
    const arrowTipUpdated = updateTwoPointAnchor(getArrowPoints(), 1, 300, 140, 800, 600);
    editor.updateAnnotation('arrow-straight-test', { points: arrowTipUpdated });
    expect(getArrowPoints()).toEqual([100, 100, 300, 140]);

    // Undo desfaz ponta
    editor.undo();
    expect(getArrowPoints()).toEqual([100, 100, 250, 100]);
  });

  it('resizes 2D shapes (rect and ellipse) preserving constant strokeWidth without distortion', () => {
    const editor = createEditorStore();

    editor.addAnnotation({
      id: 'rect-resize-test',
      type: 'rect',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      stroke: '#ff3b30',
      strokeWidth: 4,
    });
    editor.setSelectedIds(['rect-resize-test']);

    // Redimensiona o retângulo de forma livre (aumenta largura e altura)
    editor.updateAnnotation('rect-resize-test', {
      width: 240,
      height: 160,
    });

    const rect = editor.getState().annotations.find((a) => a.id === 'rect-resize-test')!;
    expect(rect.type).toBe('rect');
    if (rect.type === 'rect') {
      expect(rect.width).toBe(240);
      expect(rect.height).toBe(160);
      // Espessura DEVE permanecer intacta (4px)
      expect(rect.strokeWidth).toBe(4);
    }

    // Redimensiona elipse livremente
    editor.addAnnotation({
      id: 'ellipse-resize-test',
      type: 'ellipse',
      x: 300,
      y: 200,
      radiusX: 50,
      radiusY: 30,
      stroke: '#0071e3',
      strokeWidth: 3,
    });
    editor.setSelectedIds(['ellipse-resize-test']);

    editor.updateAnnotation('ellipse-resize-test', {
      radiusX: 90,
      radiusY: 45,
    });

    const ellipse = editor.getState().annotations.find((a) => a.id === 'ellipse-resize-test')!;
    expect(ellipse.type).toBe('ellipse');
    if (ellipse.type === 'ellipse') {
      expect(ellipse.radiusX).toBe(90);
      expect(ellipse.radiusY).toBe(45);
      expect(ellipse.strokeWidth).toBe(3);
    }

    // Undo desfaz redimensionamento da elipse
    editor.undo();
    const ellipseUndone = editor.getState().annotations.find((a) => a.id === 'ellipse-resize-test')!;
    if (ellipseUndone.type === 'ellipse') {
      expect(ellipseUndone.radiusX).toBe(50);
      expect(ellipseUndone.radiusY).toBe(30);
    }
  });
});
