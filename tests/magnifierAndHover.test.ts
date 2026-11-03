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
  calculateMagnifierFocusGeometry,
  clampFocusPointToImageBounds,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  snapToFontSizeStep,
  calculateResizedFontSize,
  clampTextResizeBox,
  getAnnotationSelectionOutline,
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

  it('allows attaching Transformer to magnifier and image while suppressing it for rect, ellipse, lines, arrows and text', () => {
    expect(shouldAttachTransformer('magnifier')).toBe(true);
    expect(shouldAttachTransformer('text')).toBe(false);
    expect(shouldAttachTransformer('image')).toBe(true);
    expect(shouldAttachTransformer('rect')).toBe(false);
    expect(shouldAttachTransformer('ellipse')).toBe(false);
    expect(shouldAttachTransformer('line')).toBe(false);
    expect(shouldAttachTransformer('arrow')).toBe(false);
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

  it('magnifies remote focal point (focusX, focusY) when lens is placed in a corner away from focus', () => {
    // Lupa no canto (650, 480), mas focada no detalhe em (200, 100) com zoom 2.0x
    const remoteTransform = calculateMagnifierImageTransform(650, 480, 2.0, 200, 100);
    expect(remoteTransform).toEqual({
      x: -400,
      y: -200,
      scaleX: 2.0,
      scaleY: 2.0,
    });
  });

  it('calculates sleek frosted trail from a single focal dot (without outer circle) to a compact lens spread', () => {
    // Quando o foco está no mesmo centro da lupa (modo Sem Foco), não há rastro esticado (hasOffsetFocus = false)
    const centered = calculateMagnifierFocusGeometry(300, 200, 65, 300, 200, 2.0);
    expect(centered.hasOffsetFocus).toBe(false);
    expect(centered.hasOuterFocusCircle).toBe(false);
    expect(centered.conePoints).toEqual([]);

    // Quando a lupa está com foco remoto (500, 350 -> foco em 200, 150), usa apenas o ponto focal (focusDotRadius = 5)
    // sem círculo externo e gera um rastro fosco mais estreito (lensSpread = 42% do raio da lente)
    const offset = calculateMagnifierFocusGeometry(500, 350, 100, 200, 150, 2.0);
    expect(offset.hasOffsetFocus).toBe(true);
    expect(offset.hasOuterFocusCircle).toBe(false);
    expect(offset.dx).toBe(-300);
    expect(offset.dy).toBe(-200);
    expect(offset.focusDotRadius).toBe(5);
    expect(offset.lensSpread).toBe(42); // 42% de 100, menor que o raio total da lupa
    expect(offset.conePoints.length).toBe(8);
  });

  it('clamps remote focal point within image boundaries', () => {
    expect(clampFocusPointToImageBounds(-50, 900, 800, 600, 14)).toEqual({
      x: 14,
      y: 586,
    });
    expect(clampFocusPointToImageBounds(320, 240, 800, 600, 14)).toEqual({
      x: 320,
      y: 240,
    });
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

  it('includes redaction annotations within selection box bounds', () => {
    const annotations: any[] = [
      {
        id: 'redact-1',
        type: 'redaction',
        mode: 'rect',
        x: 50,
        y: 50,
        width: 100,
        height: 40,
      },
      {
        id: 'redact-brush',
        type: 'redaction',
        mode: 'brush',
        points: [60, 60, 80, 80],
      },
      {
        id: 'redact-outside',
        type: 'redaction',
        mode: 'rect',
        x: 300,
        y: 300,
        width: 50,
        height: 50,
      },
    ];
    const box = { x: 40, y: 40, width: 120, height: 100 };
    const hitIds = getAnnotationsInSelectionBox(annotations, box);
    expect(hitIds).toContain('redact-1');
    expect(hitIds).toContain('redact-brush');
    expect(hitIds).not.toContain('redact-outside');
  });
});

describe('Text Block Stepped Font-Size Resizing (12..48 Sem Distorção)', () => {
  it('snaps arbitrary font sizes to FONT_SIZES steps and clamps strictly between 12 and 48', () => {
    expect(MIN_FONT_SIZE).toBe(12);
    expect(MAX_FONT_SIZE).toBe(48);

    expect(snapToFontSizeStep(6)).toBe(12);
    expect(snapToFontSizeStep(12)).toBe(12);
    expect(snapToFontSizeStep(13.5)).toBe(14);
    expect(snapToFontSizeStep(18)).toBe(18);
    expect(snapToFontSizeStep(23)).toBe(24);
    expect(snapToFontSizeStep(35)).toBe(36);
    expect(snapToFontSizeStep(48)).toBe(48);
    expect(snapToFontSizeStep(96)).toBe(48);
  });

  it('scales text fontSize in discrete steps from 12 up to 48 and down to 12 when resizing', () => {
    // Bloco criado com tamanho 12: cresce em degraus até travar em 48 e não diminui abaixo de 12
    expect(calculateResizedFontSize(12, 0.5)).toBe(12);
    expect(calculateResizedFontSize(12, 1.0)).toBe(12);
    expect(calculateResizedFontSize(12, 14 / 12)).toBe(14);
    expect(calculateResizedFontSize(12, 18 / 12)).toBe(18);
    expect(calculateResizedFontSize(12, 2.0)).toBe(24);
    expect(calculateResizedFontSize(12, 3.0)).toBe(36);
    expect(calculateResizedFontSize(12, 4.0)).toBe(48);
    expect(calculateResizedFontSize(12, 6.0)).toBe(48);

    // Bloco com tamanho 48: diminui em degraus até travar em 12 e não cresce acima de 48
    expect(calculateResizedFontSize(48, 1.5)).toBe(48);
    expect(calculateResizedFontSize(48, 0.75)).toBe(36);
    expect(calculateResizedFontSize(48, 0.5)).toBe(24);
    expect(calculateResizedFontSize(48, 0.25)).toBe(12);
    expect(calculateResizedFontSize(48, 0.1)).toBe(12);
  });

  it('locks the Transformer bounding box at minimum 12 and maximum 48 while stepping proportionally without distortion', () => {
    const baseBoxAt12 = { x: 100, y: 100, width: 120, height: 16, rotation: 0 };

    // Tentar diminuir abaixo de 12 trava o bloco (retorna oldBox)
    const shrinkAttempt = clampTextResizeBox(
      baseBoxAt12,
      { x: 100, y: 100, width: 90, height: 12, rotation: 0 },
      12,
      120,
      16
    );
    expect(shrinkAttempt).toEqual(baseBoxAt12);

    // Aumentar de 12 para 24 (2x) ajusta largura e altura na mesma proporção exata (sem distorcer)
    const growTo24 = clampTextResizeBox(
      baseBoxAt12,
      { x: 100, y: 100, width: 242, height: 32.26, rotation: 0 },
      12,
      120,
      16
    );
    expect(growTo24).toEqual({
      x: 100,
      y: 100,
      width: 240,
      height: 32,
      rotation: 0,
    });

    // Já em 48 (4x do tamanho 12 => width 480, height 64): tentar aumentar mais trava o bloco em 48
    const boxAt48 = { x: 100, y: 100, width: 480, height: 64, rotation: 0 };
    const overMaxAttempt = clampTextResizeBox(
      boxAt48,
      { x: 100, y: 100, width: 560, height: 74.6, rotation: 0 },
      12,
      120,
      16
    );
    expect(overMaxAttempt).toEqual(boxAt48);
  });

  describe('Multi-Selection Outlines for All Shape and Element Blocks', () => {
    it('generates centered rectangular outline for rect annotations with padding', () => {
      const rectAnn: any = {
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 45,
      };
      const outline = getAnnotationSelectionOutline(rectAnn);
      expect(outline.type).toBe('rect');
      expect(outline.x).toBe(200); // 100 + 200/2
      expect(outline.y).toBe(150); // 100 + 100/2
      expect(outline.width).toBe(206); // 200 + 6
      expect(outline.height).toBe(106); // 100 + 6
      expect(outline.offsetX).toBe(103);
      expect(outline.offsetY).toBe(53);
      expect(outline.rotation).toBe(45);
    });

    it('generates ellipse outline for ellipse annotations with padding', () => {
      const ellipseAnn: any = {
        id: 'e1',
        type: 'ellipse',
        x: 300,
        y: 250,
        radiusX: 80,
        radiusY: 50,
        stroke: '#00ff00',
        strokeWidth: 3,
        rotation: 30,
      };
      const outline = getAnnotationSelectionOutline(ellipseAnn);
      expect(outline.type).toBe('ellipse');
      expect(outline.x).toBe(300);
      expect(outline.y).toBe(250);
      expect(outline.radiusX).toBe(84); // 80 + 4
      expect(outline.radiusY).toBe(54); // 50 + 4
      expect(outline.rotation).toBe(30);
    });

    it('generates circle outline for magnifier annotations with padding', () => {
      const magAnn: any = {
        id: 'm1',
        type: 'magnifier',
        x: 150,
        y: 150,
        radius: 60,
        zoomLevel: 2,
      };
      const outline = getAnnotationSelectionOutline(magAnn);
      expect(outline.type).toBe('circle');
      expect(outline.x).toBe(150);
      expect(outline.y).toBe(150);
      expect(outline.radius).toBe(64); // 60 + 4
    });

    it('generates rectangular outline for line and arrow annotations enclosing their points', () => {
      const lineAnn: any = {
        id: 'l1',
        type: 'line',
        x: 0,
        y: 0,
        points: [50, 50, 200, 150],
        stroke: '#0000ff',
        strokeWidth: 2,
      };
      const outline = getAnnotationSelectionOutline(lineAnn);
      expect(outline.type).toBe('rect');
      expect(outline.x).toBe(125); // (50 + 200) / 2
      expect(outline.y).toBe(100); // (50 + 150) / 2
      expect(outline.width).toBe(158); // (200 - 50) + 8
      expect(outline.height).toBe(108); // (150 - 50) + 8
    });
    it('generates rectangular outline for text annotation matching calculateTextDimensions', () => {
      const textAnn: any = {
        id: 't1',
        type: 'text',
        x: 100,
        y: 100,
        text: 'Teste de Contorno',
        fontSize: 20,
        width: 250,
        autoWrap: true,
      };
      const outline = getAnnotationSelectionOutline(textAnn);
      expect(outline.type).toBe('rect');
      expect(outline.width).toBe(258); // 250 + padding*2 (4*2 = 8)
      expect(outline.x).toBe(225); // 100 + 250/2
    });

    it('generates rectangular outline for smart-text redaction annotation matching its width and height', () => {
      const smartTextAnn: any = {
        id: 'st1',
        type: 'redaction',
        mode: 'smart-text',
        x: 80,
        y: 40,
        width: 160,
        height: 50,
      };
      const outline = getAnnotationSelectionOutline(smartTextAnn);
      expect(outline.type).toBe('rect');
      expect(outline.width).toBe(166); // 160 + padding*2 (3*2 = 6)
      expect(outline.height).toBe(56); // 50 + padding*2 (3*2 = 6)
      expect(outline.x).toBe(160); // 80 + 160 / 2
      expect(outline.y).toBe(65); // 40 + 50 / 2
    });
  });
});
