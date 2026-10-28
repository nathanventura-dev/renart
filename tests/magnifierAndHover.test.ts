// tests/magnifierAndHover.test.ts
import { describe, it, expect } from 'vitest';
import {
  ZOOM_STEPS,
  snapToZoomStep,
  calculateZoomFromCrownDrag,
  calculateMagnifierImageTransform,
  calculateCrownRotationAngle,
  resolveCanvasPointerBehavior,
  shouldShowZoomBar,
  calculateZoomBarProgress,
  shouldAttachTransformer,
  isTargetExistingAnnotation,
  getAnnotationsInSelectionBox,
  clampMagnifierToImageBounds,
  sortAnnotationsWithMagnifiersOnTop,
  getMagnifierVisibleAnnotations,
} from '../src/utils/magnifierAndHover';

describe('Magnifier Zoom & Rotating Crown (Coroa Giratória)', () => {
  it('exposes exact allowed zoom steps from 1.0 to 3.0 in increments of 0.5', () => {
    expect(ZOOM_STEPS).toEqual([1.0, 1.5, 2.0, 2.5, 3.0]);
  });

  it('snaps arbitrary values to valid 0.5 zoom increments clamped between 1.0 and 3.0', () => {
    expect(snapToZoomStep(0.5)).toBe(1.0);
    expect(snapToZoomStep(1.0)).toBe(1.0);
    expect(snapToZoomStep(1.24)).toBe(1.0);
    expect(snapToZoomStep(1.26)).toBe(1.5);
    expect(snapToZoomStep(2.0)).toBe(2.0);
    expect(snapToZoomStep(2.74)).toBe(2.5);
    expect(snapToZoomStep(2.76)).toBe(3.0);
    expect(snapToZoomStep(4.5)).toBe(3.0);
  });

  it('increases zoom in 0.5 steps when dragging crown to the right and clamps at 3.0', () => {
    // 30px por step de 0.5
    expect(calculateZoomFromCrownDrag(1.0, 10, 30)).toBe(1.0);
    expect(calculateZoomFromCrownDrag(1.0, 30, 30)).toBe(1.5);
    expect(calculateZoomFromCrownDrag(1.0, 60, 30)).toBe(2.0);
    expect(calculateZoomFromCrownDrag(1.0, 90, 30)).toBe(2.5);
    expect(calculateZoomFromCrownDrag(1.0, 120, 30)).toBe(3.0);
    expect(calculateZoomFromCrownDrag(1.0, 240, 30)).toBe(3.0); // máximo 3.0
  });

  it('decreases zoom in 0.5 steps when dragging crown to the left and clamps at 1.0', () => {
    expect(calculateZoomFromCrownDrag(2.5, -30, 30)).toBe(2.0);
    expect(calculateZoomFromCrownDrag(2.5, -60, 30)).toBe(1.5);
    expect(calculateZoomFromCrownDrag(2.5, -90, 30)).toBe(1.0);
    expect(calculateZoomFromCrownDrag(2.5, -180, 30)).toBe(1.0); // mínimo 1.0
  });

  it('calculates exact inner image transform so lens magnifies underlying content around center', () => {
    // Em 1.0x, o deslocamento deve ser exatamente (-x, -y) com escala 1.0
    const transform1x = calculateMagnifierImageTransform(200, 150, 1.0);
    expect(transform1x).toEqual({
      x: -200,
      y: -150,
      scaleX: 1.0,
      scaleY: 1.0,
    });

    // Em 2.5x, o ponto (200, 150) deve permanecer no centro (0, 0) da lupa: -200 * 2.5 = -500, -150 * 2.5 = -375
    const transform25x = calculateMagnifierImageTransform(200, 150, 2.5);
    expect(transform25x).toEqual({
      x: -500,
      y: -375,
      scaleX: 2.5,
      scaleY: 2.5,
    });
  });

  it('computes crown rotation angle proportional to zoom level', () => {
    const angleMin = calculateCrownRotationAngle(1.0);
    const angleMid = calculateCrownRotationAngle(2.0);
    const angleMax = calculateCrownRotationAngle(3.0);

    expect(angleMin).toBe(-60);
    expect(angleMid).toBe(0);
    expect(angleMax).toBe(60);
  });

  it('shows minimalist bottom zoom bar ONLY while actively dragging crown to adjust zoom', () => {
    expect(shouldShowZoomBar(null, 'mag-1')).toBe(false);
    expect(shouldShowZoomBar('mag-2', 'mag-1')).toBe(false);
    expect(shouldShowZoomBar('mag-1', 'mag-1')).toBe(true);
  });

  it('calculates normalized zoom bar progress [0..1] for minimalist bottom bar', () => {
    expect(calculateZoomBarProgress(1.0)).toBe(0);
    expect(calculateZoomBarProgress(1.5)).toBe(0.25);
    expect(calculateZoomBarProgress(2.0)).toBe(0.5);
    expect(calculateZoomBarProgress(2.5)).toBe(0.75);
    expect(calculateZoomBarProgress(3.0)).toBe(1.0);
  });

  it('allows attaching Transformer to magnifier as well as all other blocks for resizing', () => {
    expect(shouldAttachTransformer('magnifier')).toBe(true);
    expect(shouldAttachTransformer('rect')).toBe(true);
    expect(shouldAttachTransformer('ellipse')).toBe(true);
    expect(shouldAttachTransformer('line')).toBe(true);
    expect(shouldAttachTransformer('arrow')).toBe(true);
    expect(shouldAttachTransformer('text')).toBe(true);
    expect(shouldAttachTransformer('image')).toBe(true);
  });

  it('allows resizing magnifier radius freely while clamping radius and position to image boundaries', () => {
    // Redimensionamento normal dentro da imagem (800x600)
    const normal = clampMagnifierToImageBounds(300, 250, 120, 800, 600);
    expect(normal).toEqual({ x: 300, y: 250, radius: 120 });

    // Se o usuário esticar além da altura da imagem (600px -> raio máximo = 300px), respeita o limite da imagem
    const clampedMax = clampMagnifierToImageBounds(400, 300, 500, 800, 600);
    expect(clampedMax.radius).toBe(300);
    expect(clampedMax.x).toBe(400);
    expect(clampedMax.y).toBe(300);

    // Se a lupa estiver próxima à borda esquerda/superior e for aumentada, mantém dentro dos limites da imagem
    const clampedEdge = clampMagnifierToImageBounds(20, 30, 100, 800, 600);
    expect(clampedEdge).toEqual({ x: 100, y: 100, radius: 100 });
  });

  it('keeps magnifier always above all other elements and exposes all non-magnifier blocks to the lens', () => {
    const list = [
      { id: 'mag-1', type: 'magnifier' as const, x: 100, y: 100, radius: 65, zoomLevel: 2.0 },
      { id: 'rect-1', type: 'rect' as const, x: 20, y: 20, width: 100, height: 80 },
      { id: 'line-1', type: 'line' as const, x: 0, y: 0, points: [10, 50, 150, 50] },
      { id: 'arrow-1', type: 'arrow' as const, x: 0, y: 0, points: [20, 20, 90, 90] },
      { id: 'ellipse-1', type: 'ellipse' as const, x: 80, y: 80, radiusX: 30, radiusY: 20 },
    ];

    // A lupa deve ficar sempre por último na ordem de renderização (acima de todos os elementos)
    const sorted = sortAnnotationsWithMagnifiersOnTop(list);
    expect(sorted.map((a) => a.id)).toEqual(['rect-1', 'line-1', 'arrow-1', 'ellipse-1', 'mag-1']);

    // A lente da lupa deve enxergar todos os blocos adicionados (exceto a própria lupa)
    const visibleInLens = getMagnifierVisibleAnnotations(list);
    expect(visibleInLens.map((a) => a.id)).toEqual(['rect-1', 'line-1', 'arrow-1', 'ellipse-1']);
  });
});

describe('Smart Hover & Drag-and-Drop Pointer Recognition', () => {
  it('switches cursor to move and action to move-existing when hovering over a block with a creation tool selected', () => {
    const rectToolHoverInside = resolveCanvasPointerBehavior('rect', true, false);
    expect(rectToolHoverInside).toEqual({
      cursor: 'move',
      clickAction: 'move-existing',
    });

    const arrowToolHoverInside = resolveCanvasPointerBehavior('arrow', true, false);
    expect(arrowToolHoverInside).toEqual({
      cursor: 'move',
      clickAction: 'move-existing',
    });
  });

  it('switches cursor to crosshair and action to create-new when hovering outside blocks with a creation tool selected', () => {
    const rectToolHoverOutside = resolveCanvasPointerBehavior('rect', false, false);
    expect(rectToolHoverOutside).toEqual({
      cursor: 'crosshair',
      clickAction: 'create-new',
    });

    const magnifierHoverOutside = resolveCanvasPointerBehavior('magnifier', false, false);
    expect(magnifierHoverOutside).toEqual({
      cursor: 'crosshair',
      clickAction: 'create-new',
    });
  });

  it('does not create new blocks when pointer (select) tool is active and clicking outside', () => {
    const selectHoverOutside = resolveCanvasPointerBehavior('select', false, false);
    expect(selectHoverOutside).toEqual({
      cursor: 'default',
      clickAction: 'deselect',
    });

    const selectHoverInside = resolveCanvasPointerBehavior('select', true, false);
    expect(selectHoverInside).toEqual({
      cursor: 'move',
      clickAction: 'move-existing',
    });
  });

  it('prevents moving existing blocks when canvas is locked after saving', () => {
    const lockedHoverInside = resolveCanvasPointerBehavior('rect', true, true);
    expect(lockedHoverInside.cursor).toBe('default');
  });

  it('never treats background image or empty stage as an existing block when switching tools', () => {
    // Fundo da imagem ('bg-image') ou o próprio Stage nunca são blocos
    expect(isTargetExistingAnnotation('bg-image', false)).toBe(false);
    expect(isTargetExistingAnnotation('', true)).toBe(false);
    expect(isTargetExistingAnnotation('magnifier-crown', false)).toBe(false);

    // Qualquer bloco real na camada de anotações é reconhecido como bloco existente
    expect(isTargetExistingAnnotation('annotation-block', false)).toBe(true);

    // Ao alternar entre tipos de blocos (rect, ellipse, arrow, text, magnifier) sobre a imagem de fundo,
    // a ação deve ser sempre 'create-new' com cursor 'crosshair'
    const tools = ['rect', 'ellipse', 'arrow', 'text', 'magnifier'] as const;
    for (const tool of tools) {
      const overBg = isTargetExistingAnnotation('bg-image', false);
      expect(resolveCanvasPointerBehavior(tool, overBg, false)).toEqual({
        cursor: 'crosshair',
        clickAction: 'create-new',
      });
    }
  });

  it('identifies all annotations intersecting a marquee selection box when clicking and dragging', () => {
    const annotations = [
      { id: 'r1', type: 'rect' as const, x: 20, y: 20, width: 50, height: 40 },
      { id: 'l1', type: 'line' as const, x: 0, y: 0, points: [30, 75, 120, 75] },
      { id: 'a1', type: 'arrow' as const, x: 0, y: 0, points: [80, 30, 140, 70] },
      { id: 'e1', type: 'ellipse' as const, x: 400, y: 400, radiusX: 30, radiusY: 20 },
    ];

    const selected = getAnnotationsInSelectionBox(annotations, {
      x: 10,
      y: 10,
      width: 150,
      height: 90,
    });

    expect(selected).toEqual(['r1', 'l1', 'a1']);
  });
});
