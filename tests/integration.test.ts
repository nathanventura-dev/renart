// tests/integration.test.ts
import { describe, it, expect } from 'vitest';
import { createGalleryStore } from '../src/state/galleryStore';
import { createEditorStore, RectAnnotation } from '../src/state/editorStore';
import {
  updateCurvedArrowAnchor,
  updateTwoPointAnchor,
  updateCornerResize,
  updateShapeRotation,
  getFourCornerPositions,
  snapAngleToStep,
  snapLinePointsWithShift,
  snapRectWithShift,
  getTwoPointAnchorDragBound,
  clampRectToBounds,
  getTransformedDragBound,
  getOpenChevronArrowPoints,
  getCropVisualGuides,
  resolveZoomOnImageLoad,
} from '../src/utils/zoomAndCrop';
import { calculateNativeExportPixelRatio } from '../src/services/exportService';
import { getAnnotationSelectionOutline } from '../src/utils/magnifierAndHover';

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

  it('updates 4-corner resize and 360 rotation for rect and ellipse with full undo/redo support', () => {
    const editor = createEditorStore();

    editor.addAnnotation({
      id: 'rect-4corner-test',
      type: 'rect',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      stroke: '#ff3b30',
      strokeWidth: 4,
      rotation: 0,
    });
    editor.setSelectedIds(['rect-4corner-test']);

    // Simula arrastar o canto BR (index 2) usando updateCornerResize
    const rectAnn = editor.getState().annotations.find((a) => a.id === 'rect-4corner-test')!;
    const resizeUpdate = updateCornerResize(rectAnn, 2, { x: 350, y: 250 }, 800, 600);
    editor.updateAnnotation('rect-4corner-test', resizeUpdate);

    let updatedRect = editor.getState().annotations.find((a) => a.id === 'rect-4corner-test')!;
    if (updatedRect.type === 'rect') {
      expect(updatedRect.x).toBe(100);
      expect(updatedRect.y).toBe(100);
      expect(updatedRect.width).toBe(250);
      expect(updatedRect.height).toBe(150);
      expect(updatedRect.strokeWidth).toBe(4);
    }

    // Simula arrastar a alça de rotação para a direita (90 graus)
    const rot = updateShapeRotation(updatedRect, { x: 350, y: 175 }); // centro é (225, 175)
    expect(rot).toBeCloseTo(90, 0);
    editor.updateAnnotation('rect-4corner-test', { rotation: rot });

    updatedRect = editor.getState().annotations.find((a) => a.id === 'rect-4corner-test')!;
    expect(updatedRect.rotation).toBeCloseTo(90, 0);

    // Undo desfaz rotação
    editor.undo();
    updatedRect = editor.getState().annotations.find((a) => a.id === 'rect-4corner-test')!;
    expect(updatedRect.rotation).toBe(0);

    // Undo desfaz redimensionamento
    editor.undo();
    updatedRect = editor.getState().annotations.find((a) => a.id === 'rect-4corner-test')!;
    if (updatedRect.type === 'rect') {
      expect(updatedRect.width).toBe(200);
      expect(updatedRect.height).toBe(100);
    }
  });

  it('generates multi-selection outlines only for selected blocks and keeps anchor points glued during rotation and movement', () => {
    const editor = createEditorStore();

    // Adiciona 3 blocos diferentes
    editor.addAnnotation({
      id: 'block-rect',
      type: 'rect',
      x: 100,
      y: 100,
      width: 150,
      height: 80,
      stroke: '#ff0000',
      strokeWidth: 4,
      rotation: 45,
    });
    editor.addAnnotation({
      id: 'block-ellipse',
      type: 'ellipse',
      x: 400,
      y: 200,
      radiusX: 60,
      radiusY: 40,
      stroke: '#00ff00',
      strokeWidth: 3,
      rotation: 0,
    });
    editor.addAnnotation({
      id: 'block-unselected',
      type: 'rect',
      x: 600,
      y: 300,
      width: 100,
      height: 100,
      stroke: '#0000ff',
      strokeWidth: 2,
    });

    // Seleciona múltiplos blocos: 'block-rect' e 'block-ellipse'
    editor.setSelectedIds(['block-rect', 'block-ellipse']);
    const selectedIds = editor.getState().selectedIds;
    expect(selectedIds).toHaveLength(2);

    const allAnnotations = editor.getState().annotations;
    const outlines = allAnnotations
      .filter((a) => selectedIds.includes(a.id))
      .map((a) => ({ id: a.id, outline: getAnnotationSelectionOutline(a) }));

    expect(outlines).toHaveLength(2);
    expect(outlines.find((o) => o.id === 'block-rect')?.outline.type).toBe('rect');
    expect(outlines.find((o) => o.id === 'block-ellipse')?.outline.type).toBe('ellipse');
    // Bloco não selecionado não está na lista de contornos
    expect(outlines.find((o) => o.id === 'block-unselected')).toBeUndefined();

    // Verifica que os 4 cantos e o rotater permanecem colados durante rotação e movimentação
    const rectAnn = allAnnotations.find((a) => a.id === 'block-rect')!;
    const initialCorners = getFourCornerPositions(rectAnn);
    expect(initialCorners.center).toEqual({ x: 175, y: 140 });

    // Move o elemento para uma nova posição (ex: x + 100, y + 50)
    editor.updateAnnotation('block-rect', { x: 200, y: 150 });
    const movedRect = editor.getState().annotations.find((a) => a.id === 'block-rect')!;
    const movedCorners = getFourCornerPositions(movedRect);
    expect(movedCorners.center).toEqual({ x: 275, y: 190 });
    expect(movedCorners.rotater.x).toBeCloseTo(initialCorners.rotater.x + 100, 0);
    expect(movedCorners.rotater.y).toBeCloseTo(initialCorners.rotater.y + 50, 0);
  });

  it('supports Shift snapping for straight horizontal/vertical lines, square proportions, 15-degree rotation steps and double-click straighten to 0 deg', () => {
    const editor = createEditorStore();

    // 1. Desenho de linha reta com Shift:
    // Começa em (100, 100) e arrasta mouse até (250, 115) (pequeno desvio vertical)
    const snappedLineEnd = snapLinePointsWithShift(100, 100, 250, 115);
    // Deve travar perfeitamente na horizontal: dy = 0, y = 100
    expect(snappedLineEnd).toEqual({ x: 250, y: 100 });

    editor.addAnnotation({
      id: 'straight-line-1',
      type: 'line',
      points: [100, 100, snappedLineEnd.x, snappedLineEnd.y],
      stroke: '#0071e3',
      strokeWidth: 3,
    });
    const lineAnn = editor.getState().annotations.find((a) => a.id === 'straight-line-1');
    expect(lineAnn?.type).toBe('line');
    if (lineAnn?.type === 'line') {
      expect(lineAnn.points).toEqual([100, 100, 250, 100]);
    }

    // 2. Ajuste de âncora com Shift para linha:
    // O ponto de redimensionamento (âncora) e o endpoint da linha se movem juntos e colados
    // Ponto fixo em (100, 100), cursor arrastado até (280, 120) com Shift
    const anchorDragShifted = getTwoPointAnchorDragBound(280, 120, { x: 100, y: 100 }, true, 800, 600);
    // Deve travar no eixo perfeitamente horizontal (y = 100)
    expect(anchorDragShifted).toEqual({ x: 280, y: 100 });

    const updatedPoints = updateTwoPointAnchor(
      lineAnn?.type === 'line' ? lineAnn.points : [],
      1,
      anchorDragShifted.x,
      anchorDragShifted.y,
      800,
      600
    );
    expect(updatedPoints).toEqual([100, 100, 280, 100]);
    // A âncora (anchorDragShifted) e o endpoint da linha (updatedPoints[2], updatedPoints[3]) são idênticos:
    expect(anchorDragShifted.x).toBe(updatedPoints[2]);
    expect(anchorDragShifted.y).toBe(updatedPoints[3]);

    // Sem Shift, a âncora e a linha seguem livres juntas:
    const anchorDragFree = getTwoPointAnchorDragBound(280, 120, { x: 100, y: 100 }, false, 800, 600);
    expect(anchorDragFree).toEqual({ x: 280, y: 120 });
    const freePoints = updateTwoPointAnchor(
      lineAnn?.type === 'line' ? lineAnn.points : [],
      1,
      anchorDragFree.x,
      anchorDragFree.y,
      800,
      600
    );
    expect(freePoints).toEqual([100, 100, 280, 120]);
    expect(anchorDragFree.x).toBe(freePoints[2]);
    expect(anchorDragFree.y).toBe(freePoints[3]);

    // Ajuste de âncora com Shift para linha vertical:
    // Âncora oposta em (100, 100), arrasto até (112, 300)
    const snappedVerticalEnd = snapLinePointsWithShift(100, 100, 112, 300);
    expect(snappedVerticalEnd).toEqual({ x: 100, y: 300 });

    // 3. Desenho de retângulo com Shift travando proporção 1:1 (quadrado perfeito):
    // Começa em (50, 50) e arrasta até (180, 220) -> dx = 130, dy = 170 -> max = 170
    const squareDimensions = snapRectWithShift(50, 50, 180, 220);
    expect(squareDimensions).toEqual({ width: 170, height: 170 });
    expect(Math.abs(squareDimensions.width)).toBe(Math.abs(squareDimensions.height));

    editor.addAnnotation({
      id: 'square-rect-1',
      type: 'rect',
      x: 50,
      y: 50,
      width: squareDimensions.width,
      height: squareDimensions.height,
      stroke: '#ff3b30',
      strokeWidth: 2,
      rotation: 0,
    });
    const squareAnn = editor.getState().annotations.find((a) => a.id === 'square-rect-1');
    expect(squareAnn?.type).toBe('rect');
    if (squareAnn?.type === 'rect') {
      expect(squareAnn.width).toBe(170);
      expect(squareAnn.height).toBe(170);
    }

    // 4. Rotação em degraus de 15° com tecla Shift:
    // Ângulo levemente desalinhado (ex: 1.4° ou 88.6°) snapa com precisão
    expect(snapAngleToStep(1.4, 15)).toBe(0);
    expect(snapAngleToStep(14.8, 15)).toBe(15);
    expect(snapAngleToStep(44.2, 15)).toBe(45);
    expect(snapAngleToStep(88.6, 15)).toBe(90);

    // Aplica rotação de 90° ao quadrado
    editor.updateAnnotation('square-rect-1', { rotation: snapAngleToStep(88.6, 15) });
    expect(editor.getState().annotations.find((a) => a.id === 'square-rect-1')!.rotation).toBe(90);

    // 5. Duplo-clique no ícone de rotação para resetar para 0° (perfeitamente horizontal):
    editor.updateAnnotation('square-rect-1', { rotation: 0 });
    expect(editor.getState().annotations.find((a) => a.id === 'square-rect-1')!.rotation).toBe(0);

    // 6. Suporte completo a Undo / Redo para o reset de rotação:
    editor.undo();
    expect(editor.getState().annotations.find((a) => a.id === 'square-rect-1')!.rotation).toBe(90);

    editor.redo();
    expect(editor.getState().annotations.find((a) => a.id === 'square-rect-1')!.rotation).toBe(0);
  });

  it('resizes rectangle to larger size, rotates 180 and 90 degrees (vertical), and respects image boundaries with or without zoom', () => {
    const editor = createEditorStore();
    const canvasWidth = 800;
    const canvasHeight = 600;

    // 1. Cria retângulo inicial
    editor.addAnnotation({
      id: 'rect-flow-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      stroke: '#ff0000',
      strokeWidth: 2,
      rotation: 0,
    });

    const rect = editor.getState().annotations.find((a) => a.id === 'rect-flow-1')!;

    // 2. Redimensiona para maior (350x250) arrastando o canto BR
    const resized = updateCornerResize(rect, 2, { x: 450, y: 350 }, canvasWidth, canvasHeight) as Partial<RectAnnotation>;
    expect(resized.width).toBe(350);
    expect(resized.height).toBe(250);
    editor.updateAnnotation('rect-flow-1', resized);

    // 3. Gira 180 graus (ou vertical 90 graus)
    editor.updateAnnotation('rect-flow-1', { rotation: 180 });
    const rect180 = editor.getState().annotations.find((a) => a.id === 'rect-flow-1') as RectAnnotation;
    expect(rect180.rotation).toBe(180);

    // 4. Garante respeito estrito à área útil ao movimentar nos extremos, independente de zoom (100% e 200%)
    for (const zoom of [1.0, 2.0, 0.5]) {
      // Arrastar além da borda esquerda/topo (-200, -200)
      const clampedTopLeft = getTransformedDragBound({ x: -200 * zoom, y: -200 * zoom }, zoom, (lx, ly) => {
        const rawLeft = lx - rect180.width / 2;
        const rawTop = ly - rect180.height / 2;
        const clamped = clampRectToBounds(rawLeft, rawTop, rect180.width, rect180.height, canvasWidth, canvasHeight, 1, 1, 180);
        return {
          x: clamped.x + rect180.width / 2,
          y: clamped.y + rect180.height / 2,
        };
      });
      // Em coordenadas locais (desfeitas de zoom), o centro nunca pode violar o canvas
      const localCenterTL = { x: clampedTopLeft.x / zoom, y: clampedTopLeft.y / zoom };
      expect(localCenterTL.x - rect180.width / 2).toBeGreaterThanOrEqual(0);
      expect(localCenterTL.y - rect180.height / 2).toBeGreaterThanOrEqual(0);

      // Arrastar além da borda direita/fundo (1000, 1000)
      const clampedBottomRight = getTransformedDragBound({ x: 1000 * zoom, y: 1000 * zoom }, zoom, (lx, ly) => {
        const rawLeft = lx - rect180.width / 2;
        const rawTop = ly - rect180.height / 2;
        const clamped = clampRectToBounds(rawLeft, rawTop, rect180.width, rect180.height, canvasWidth, canvasHeight, 1, 1, 180);
        return {
          x: clamped.x + rect180.width / 2,
          y: clamped.y + rect180.height / 2,
        };
      });
      const localCenterBR = { x: clampedBottomRight.x / zoom, y: clampedBottomRight.y / zoom };
      expect(localCenterBR.x + rect180.width / 2).toBeLessThanOrEqual(canvasWidth);
      expect(localCenterBR.y + rect180.height / 2).toBeLessThanOrEqual(canvasHeight);
    }

    // 5. Rotação vertical (90 graus)
    editor.updateAnnotation('rect-flow-1', { rotation: 90 });
    const rect90 = editor.getState().annotations.find((a) => a.id === 'rect-flow-1') as RectAnnotation;
    // Ao girar verticalmente, a largura na tela passa a ser height (250) e a altura width (350)
    // Ao arrastar nos cantos da tela, todas as 4 extremidades devem permanecer contidas no canvas [0..800, 0..600]
    const clamped90 = clampRectToBounds(-100, -100, rect90.width, rect90.height, canvasWidth, canvasHeight, 1, 1, 90);
    const center90 = { x: clamped90.x + rect90.width / 2, y: clamped90.y + rect90.height / 2 };
    // Largura projetada: height/2 = 125. Altura projetada: width/2 = 175.
    expect(center90.x - rect90.height / 2).toBeGreaterThanOrEqual(0);
    expect(center90.y - rect90.width / 2).toBeGreaterThanOrEqual(0);
    expect(center90.x + rect90.height / 2).toBeLessThanOrEqual(canvasWidth);
    expect(center90.y + rect90.width / 2).toBeLessThanOrEqual(canvasHeight);
  });

  it('integrates thin chevron arrow with 2-point anchor adjustments, chevron points computation, and undo/redo', () => {
    const editor = createEditorStore();

    // 1. Cria flecha fina (arrowStyle: 'thin')
    editor.addAnnotation({
      id: 'arrow-thin-integ',
      type: 'arrow',
      points: [50, 50, 200, 50],
      stroke: '#0071e3',
      strokeWidth: 2,
      arrowStyle: 'thin',
    });
    editor.setSelectedIds(['arrow-thin-integ']);

    const getThinArrow = () => {
      const ann = editor.getState().annotations.find((a) => a.id === 'arrow-thin-integ');
      return ann?.type === 'arrow' ? ann : null;
    };

    const initialAnn = getThinArrow()!;
    expect(initialAnn.arrowStyle).toBe('thin');
    expect(initialAnn.strokeWidth).toBe(2);

    // 2. Geometria de chevron inicial (horizontal)
    const initialChevron = getOpenChevronArrowPoints(
      initialAnn.points[0],
      initialAnn.points[1],
      initialAnn.points[2],
      initialAnn.points[3],
      initialAnn.strokeWidth
    );
    expect(initialChevron.shaftPoints).toEqual([50, 50, 200, 50]);
    expect(initialChevron.chevronPoints[2]).toBe(200); // Ponta X
    expect(initialChevron.chevronPoints[3]).toBe(50);  // Ponta Y
    // As abas recuam para a esquerda em relação a x=200
    expect(initialChevron.chevronPoints[0]).toBeLessThan(200);
    expect(initialChevron.chevronPoints[4]).toBeLessThan(200);

    // 3. Ajusta a ponta (âncora 1) para (250, 100)
    const updatedTipPoints = updateTwoPointAnchor(initialAnn.points, 1, 250, 100, 800, 600);
    editor.updateAnnotation('arrow-thin-integ', { points: updatedTipPoints });

    const afterTipAnn = getThinArrow()!;
    expect(afterTipAnn.points).toEqual([50, 50, 250, 100]);
    const rotatedChevron = getOpenChevronArrowPoints(
      afterTipAnn.points[0],
      afterTipAnn.points[1],
      afterTipAnn.points[2],
      afterTipAnn.points[3],
      afterTipAnn.strokeWidth
    );
    expect(rotatedChevron.shaftPoints).toEqual([50, 50, 250, 100]);
    expect(rotatedChevron.chevronPoints[2]).toBe(250);
    expect(rotatedChevron.chevronPoints[3]).toBe(100);

    // 4. Ajusta a cauda (âncora 0) para (20, 30)
    const updatedTailPoints = updateTwoPointAnchor(afterTipAnn.points, 0, 20, 30, 800, 600);
    editor.updateAnnotation('arrow-thin-integ', { points: updatedTailPoints });

    const afterTailAnn = getThinArrow()!;
    expect(afterTailAnn.points).toEqual([20, 30, 250, 100]);

    // 5. Histórico Undo/Redo
    editor.undo(); // Desfaz ajuste da cauda
    expect(getThinArrow()!.points).toEqual([50, 50, 250, 100]);

    editor.undo(); // Desfaz ajuste da ponta
    expect(getThinArrow()!.points).toEqual([50, 50, 200, 50]);

    editor.redo(); // Refaz ajuste da ponta
    expect(getThinArrow()!.points).toEqual([50, 50, 250, 100]);

    editor.redo(); // Refaz ajuste da cauda
    expect(getThinArrow()!.points).toEqual([20, 30, 250, 100]);
  });

  it('integrates minimalist crop guides synchronization with crop box manipulation and clamping', () => {
    // 1. Quadro de recorte inicial
    const initialCrop = { x: 50, y: 50, width: 400, height: 300 };
    const guides = getCropVisualGuides(initialCrop, 14, 12);

    expect(guides.corners).toHaveLength(4);
    expect(guides.edgeBars).toHaveLength(4);
    expect(guides.gridLines).toHaveLength(4);

    // 2. Simula redimensionamento do recorte (ex: 80, 80, 300, 200)
    const updatedCrop = { x: 80, y: 80, width: 300, height: 200 };
    const updatedGuides = getCropVisualGuides(updatedCrop, 14, 12);

    const tl = updatedGuides.corners.find((c) => c.name === 'crop-corner-tl')!;
    expect(tl.points).toEqual([80, 94, 80, 80, 94, 80]);

    const br = updatedGuides.corners.find((c) => c.name === 'crop-corner-br')!;
    expect(br.points).toEqual([380 - 14, 280, 380, 280, 380, 280 - 14]);

    // 3. Grid 3x3 sincronizado
    const v1 = updatedGuides.gridLines.find((g) => g.name === 'crop-grid-v1')!;
    expect(v1.points).toEqual([180, 80, 180, 280]);

    // 4. Teste com caixa de corte mínima (16x16)
    const minCrop = { x: 10, y: 10, width: 16, height: 16 };
    const minGuides = getCropVisualGuides(minCrop, 14, 12);
    // Cantos não ultrapassam a metade da largura (8px)
    const minTL = minGuides.corners.find((c) => c.name === 'crop-corner-tl')!;
    expect(minTL.points).toEqual([10, 18, 10, 10, 18, 10]);
  });

  it('guarantees 100% native preview fidelity and preserves zoom upon copying and pasting into gallery', () => {
    // 1. Inicia com tela e imagem padrão
    const gallery = createGalleryStore();
    const editor = createEditorStore();
    let zoomLevel = 1.0; // 100%

    gallery.addCapture({
      id: 'cap-initial',
      title: 'Original #1',
      dataUrl: 'data:image/png;base64,initialImage',
      createdAt: 1000,
    });
    editor.switchCapture('cap-initial', 'data:image/png;base64,initialImage');

    // 2. Adiciona anotação de edição
    editor.addAnnotation({
      id: 'arrow-edit',
      type: 'arrow',
      points: [50, 50, 200, 50],
      stroke: '#ff3b30',
      strokeWidth: 4,
      arrowStyle: 'thin',
    });
    expect(editor.getState().annotations).toHaveLength(1);

    // 3. Simula exportação/cópia com zoomLevel = 1.0
    // O pixelRatio calculado deve ser exatamente 1.0 para manter 100% dos pixels nativos sem upsampling
    const pixelRatio100 = calculateNativeExportPixelRatio(zoomLevel);
    expect(pixelRatio100).toBe(1.0);

    // Se o usuário estivesse com zoom de 60% (0.6), pixelRatio compensaria proporcionalmente
    const pixelRatio60 = calculateNativeExportPixelRatio(0.6);
    expect(pixelRatio60 * 0.6).toBeCloseTo(1.0, 2);

    // 4. Simula o usuário colando o resultado na galeria (Ctrl+V)
    const pastedId = 'pasted-001';
    const pastedDataUrl = 'data:image/png;base64,pastedCleanNative100';
    gallery.addCapture({
      id: pastedId,
      title: 'Colada #2',
      dataUrl: pastedDataUrl,
      createdAt: 2000,
    });
    editor.switchCapture(pastedId, pastedDataUrl);

    // 5. O zoom é preservado em 100% (1.0) mesmo que o fitScale calculado para uma imagem grande seja baixo
    const calculatedFitScaleForLargeImg = 0.35;
    zoomLevel = resolveZoomOnImageLoad(zoomLevel, calculatedFitScaleForLargeImg);
    expect(zoomLevel).toBe(1.0);
    expect(gallery.getState().captures).toHaveLength(2);
    expect(gallery.getState().activeId).toBe(pastedId);
  });
});
