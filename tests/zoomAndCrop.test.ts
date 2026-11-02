import { describe, it, expect } from 'vitest';
import {
  calculateFitToScreenScale,
  resolveZoomOnImageLoad,
  clampZoomLevel,
  getNextZoomStep,
  calculateCropBounds,
  adjustAnnotationsForCrop,
  ZOOM_PRESETS,
  formatZoomPercentage,
  isZoomShortcut,
  getTransformedPointerPosition,
  getTransformedDragBound,
  clampRectToBounds,
  clampEllipseToBounds,
  convertToPerfectCircle,
  clampLinePointsToBounds,
  clampAnnotationPositionToBounds,
  toLocalBoundingBox,
  toAbsoluteBoundingBox,
  calculateProportionalResizeBox,
  ARROW_STROKE_STEPS,
  ARROW_DEFAULT_STROKE,
  snapToArrowStrokeStep,
  calculateResizedArrowStroke,
  getArrowHeadDimensions,
  calculateCurvedArrowPoints,
  invertCurvedArrowPoints,
  clampArrowResizeBox,
  shouldAttachTransformer,
  updateCurvedArrowAnchor,
  getCurvedArrowAnchorPositions,
  updateTwoPointAnchor,
  getTwoPointAnchorPositions,
  getFourCornerPositions,
  updateCornerResize,
  updateShapeRotation,
  getCornerCursor,
  snapAngleToStep,
  snapLinePointsWithShift,
  snapRectWithShift,
  getTwoPointAnchorDragBound,
  getOpenChevronArrowPoints,
  getCropVisualGuides,
} from '../src/utils/zoomAndCrop';
import { Annotation } from '../src/state/editorStore';

describe('Zoom and Fit-To-Screen Calculations', () => {
  it('keeps 100% (1.0) native size when image fits within viewport without scrollbars', () => {
    // Imagem 800x600 em viewport 1200x800 com padding 24
    const scale = calculateFitToScreenScale(800, 600, 1200, 800, 24);
    expect(scale).toBe(1.0);
  });

  it('calculates proportional scale-down when image exceeds viewport so it fits 100% without scrollbars', () => {
    // Imagem 4K (3840x2160) em tela de 14 polegadas (1200x800 útil, padding 24 => 1152x752)
    const scale = calculateFitToScreenScale(3840, 2160, 1200, 800, 24);
    // 1152 / 3840 = 0.3, 752 / 2160 = 0.348 => scale deve ser 0.3
    expect(scale).toBeCloseTo(0.3, 2);
    expect(3840 * scale).toBeLessThanOrEqual(1200 - 48);
    expect(2160 * scale).toBeLessThanOrEqual(800 - 48);
  });

  it('clamps zoom levels between 25% (0.25) and 400% (4.0)', () => {
    expect(clampZoomLevel(0.1)).toBe(0.25);
    expect(clampZoomLevel(0.75)).toBe(0.75);
    expect(clampZoomLevel(1.5)).toBe(1.5);
    expect(clampZoomLevel(5.0)).toBe(4.0);
  });

  it('preserves 100% (1.0) native zoom when loading or pasting images instead of automatically forcing fit-scale', () => {
    // Quando a tela está em 100% de zoom (1.0) e uma nova imagem grande chega (fitScale = 0.35)
    expect(resolveZoomOnImageLoad(1.0, 0.35)).toBe(1.0);

    // Se o usuário já havia ajustado o zoom para 1.5x, preserva o zoom atual
    expect(resolveZoomOnImageLoad(1.5, 0.4)).toBe(1.5);

    // Se o zoom inicial for inválido ou 0, garante 100% (1.0) por padrão
    expect(resolveZoomOnImageLoad(0, 0.5)).toBe(1.0);

    // Se explicitamente configurado para não manter zoom nativo, respeita o fitScale calculado
    expect(resolveZoomOnImageLoad(1.0, 0.35, false)).toBe(0.35);
  });

  it('increments and decrements zoom in logical steps', () => {
    expect(ZOOM_PRESETS).toContain(1.0);
    expect(getNextZoomStep(1.0, 'in')).toBeGreaterThan(1.0);
    expect(getNextZoomStep(1.0, 'out')).toBeLessThan(1.0);
    expect(getNextZoomStep(4.0, 'in')).toBe(4.0); // trava no máximo
    expect(getNextZoomStep(0.25, 'out')).toBe(0.25); // trava no mínimo
  });

  it('formats zoom percentage cleanly for UI display', () => {
    expect(formatZoomPercentage(1.0)).toBe('100%');
    expect(formatZoomPercentage(0.5)).toBe('50%');
    expect(formatZoomPercentage(1.75)).toBe('175%');
    expect(formatZoomPercentage(0.333)).toBe('33%');
  });

  it('recognizes zoom keyboard shortcuts for Windows, Linux, and macOS', () => {
    // Windows / Linux: Ctrl + '+' ou Ctrl + '='
    expect(isZoomShortcut({ ctrlKey: true, metaKey: false, key: '+' })).toBe('in');
    expect(isZoomShortcut({ ctrlKey: true, metaKey: false, key: '=' })).toBe('in');
    expect(isZoomShortcut({ ctrlKey: true, metaKey: false, key: '-' })).toBe('out');
    expect(isZoomShortcut({ ctrlKey: true, metaKey: false, key: '0' })).toBe('reset');

    // macOS: Cmd + '+' / Cmd + '-' / Cmd + '0'
    expect(isZoomShortcut({ ctrlKey: false, metaKey: true, key: '+' })).toBe('in');
    expect(isZoomShortcut({ ctrlKey: false, metaKey: true, key: '-' })).toBe('out');
    expect(isZoomShortcut({ ctrlKey: false, metaKey: true, key: '0' })).toBe('reset');

    // Sem tecla modificadora: não é atalho de zoom
    expect(isZoomShortcut({ ctrlKey: false, metaKey: false, key: '+' })).toBeNull();
  });
});

describe('Crop Geometry and Annotation Adjustment', () => {
  it('clamps crop box within image boundaries with minimum 10px dimensions', () => {
    const crop = calculateCropBounds(
      { x: -50, y: -20, width: 5000, height: 3000 },
      1920,
      1080
    );
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(0);
    expect(crop.width).toBe(1920);
    expect(crop.height).toBe(1080);
  });

  it('translates annotations inside crop box by -cropOffset and discards annotations outside crop box', () => {
    const annotations: Annotation[] = [
      {
        id: 'r1',
        type: 'rect',
        x: 150,
        y: 120,
        width: 100,
        height: 80,
        stroke: '#ff3b30',
        strokeWidth: 3,
      },
      {
        id: 't1',
        type: 'text',
        x: 200,
        y: 150,
        text: 'Dentro do corte',
        fontSize: 18,
        fontFamily: 'Arial',
        fill: '#000000',
      },
      {
        id: 'r-fora',
        type: 'rect',
        x: 800,
        y: 800,
        width: 100,
        height: 100,
        stroke: '#0071e3',
        strokeWidth: 3,
      },
    ];

    // Recorta retângulo de x: 100, y: 100, width: 300, height: 200
    const adjusted = adjustAnnotationsForCrop(
      annotations,
      { x: 100, y: 100 },
      { width: 300, height: 200 }
    );

    // r1 e t1 devem ser mantidos com coordenadas deslocadas (-100, -100); r-fora deve ser descartado
    expect(adjusted).toHaveLength(2);

    const r1 = adjusted.find((a) => a.id === 'r1')!;
    expect(r1.x).toBe(50); // 150 - 100
    expect(r1.y).toBe(20); // 120 - 100

    const t1 = adjusted.find((a) => a.id === 't1')!;
    expect(t1.x).toBe(100); // 200 - 100
    expect(t1.y).toBe(50); // 150 - 100

    expect(adjusted.find((a) => a.id === 'r-fora')).toBeUndefined();
  });

  it('calculates crop visual guides: 4 L-shaped corners, 4 edge bars, and rule-of-thirds grid lines', () => {
    const cropBox = { x: 100, y: 100, width: 300, height: 200 };
    const guides = getCropVisualGuides(cropBox, 14, 12);

    expect(guides.corners).toHaveLength(4);
    expect(guides.edgeBars).toHaveLength(4);
    expect(guides.gridLines).toHaveLength(4);

    // Cantos em "L" (comprimento 14px):
    const tl = guides.corners.find((c) => c.name === 'crop-corner-tl')!;
    expect(tl.points).toEqual([100, 114, 100, 100, 114, 100]);

    const tr = guides.corners.find((c) => c.name === 'crop-corner-tr')!;
    expect(tr.points).toEqual([386, 100, 400, 100, 400, 114]);

    const bl = guides.corners.find((c) => c.name === 'crop-corner-bl')!;
    expect(bl.points).toEqual([100, 286, 100, 300, 114, 300]);

    const br = guides.corners.find((c) => c.name === 'crop-corner-br')!;
    expect(br.points).toEqual([386, 300, 400, 300, 400, 286]);

    // Barras centrais (comprimento 12px, +-6 do centro):
    const topBar = guides.edgeBars.find((b) => b.name === 'crop-edge-top')!;
    expect(topBar.points).toEqual([244, 100, 256, 100]);

    const bottomBar = guides.edgeBars.find((b) => b.name === 'crop-edge-bottom')!;
    expect(bottomBar.points).toEqual([244, 300, 256, 300]);

    const leftBar = guides.edgeBars.find((b) => b.name === 'crop-edge-left')!;
    expect(leftBar.points).toEqual([100, 194, 100, 206]);

    const rightBar = guides.edgeBars.find((b) => b.name === 'crop-edge-right')!;
    expect(rightBar.points).toEqual([400, 194, 400, 206]);

    // Linhas de terços (3x3):
    const v1 = guides.gridLines.find((g) => g.name === 'crop-grid-v1')!;
    expect(v1.points).toEqual([200, 100, 200, 300]);

    const v2 = guides.gridLines.find((g) => g.name === 'crop-grid-v2')!;
    expect(v2.points).toEqual([300, 100, 300, 300]);

    const h1 = guides.gridLines.find((g) => g.name === 'crop-grid-h1')!;
    expect(h1.points[0]).toBe(100);
    expect(h1.points[1]).toBeCloseTo(166.67, 1);
    expect(h1.points[2]).toBe(400);
    expect(h1.points[3]).toBeCloseTo(166.67, 1);

    const h2 = guides.gridLines.find((g) => g.name === 'crop-grid-h2')!;
    expect(h2.points[0]).toBe(100);
    expect(h2.points[1]).toBeCloseTo(233.33, 1);
    expect(h2.points[2]).toBe(400);
    expect(h2.points[3]).toBeCloseTo(233.33, 1);

    // Caixa de corte muito pequena (20x20px): cantos e barras são limitados a metade da dimensão (10px)
    const smallCrop = { x: 50, y: 50, width: 20, height: 20 };
    const smallGuides = getCropVisualGuides(smallCrop, 14, 12);
    const smallTL = smallGuides.corners.find((c) => c.name === 'crop-corner-tl')!;
    expect(smallTL.points).toEqual([50, 60, 50, 50, 60, 50]);
  });
});

describe('Pointer and Drag Coordinate Transformations Under Zoom', () => {
  it('converts raw pointer screen coordinates into accurate image canvas coordinates at any zoom level', () => {
    // 100% zoom: coordenadas 1:1
    expect(getTransformedPointerPosition({ x: 300, y: 200 }, 1.0)).toEqual({ x: 300, y: 200 });

    // 150% zoom: ponteiro na tela em (450, 300) deve corresponder a (300, 200) na imagem original
    expect(getTransformedPointerPosition({ x: 450, y: 300 }, 1.5)).toEqual({ x: 300, y: 200 });

    // 200% zoom: ponteiro na tela em (600, 400) corresponde a (300, 200)
    expect(getTransformedPointerPosition({ x: 600, y: 400 }, 2.0)).toEqual({ x: 300, y: 200 });

    // 50% zoom: ponteiro na tela em (150, 100) corresponde a (300, 200)
    expect(getTransformedPointerPosition({ x: 150, y: 100 }, 0.5)).toEqual({ x: 300, y: 200 });
  });

  it('clamps drag bounds across 100% of the image area when zoomed in or out without restricting to 100% viewport', () => {
    const imgWidth = 1920;
    const imgHeight = 1080;
    const radius = 65;
    const zoomLevel = 1.5;

    const clampMagnifier = (x: number, y: number) => ({
      x: Math.max(radius, Math.min(x, imgWidth - radius)),
      y: Math.max(radius, Math.min(y, imgHeight - radius)),
    });

    // Arrastando a lupa para perto da borda direita da imagem (x: 1800, y: 1000):
    // Na tela em zoom 1.5x, o ponteiro absoluto está em (2700, 1500)
    const boundInArea = getTransformedDragBound(
      { x: 2700, y: 1500 },
      zoomLevel,
      clampMagnifier
    );
    // Deve permitir posicionar a lupa livremente nos pixels reais da imagem
    expect(boundInArea.x).toBeCloseTo(2700, 1);
    expect(boundInArea.y).toBeCloseTo(1500, 1);

    // Arrastando além da borda direita (pos absoluto 3000):
    // Deve travar no limite real da imagem (1855 * 1.5 = 2782.5)
    const boundBeyondRight = getTransformedDragBound(
      { x: 3000, y: 1500 },
      zoomLevel,
      clampMagnifier
    );
    expect(boundBeyondRight.x).toBeCloseTo(1855 * 1.5, 1);

    // Arrastando além da borda esquerda (pos absoluto 30):
    // Deve travar no raio mínimo (65 * 1.5 = 97.5)
    const boundBeyondLeft = getTransformedDragBound(
      { x: 30, y: 1500 },
      zoomLevel,
      clampMagnifier
    );
    expect(boundBeyondLeft.x).toBeCloseTo(65 * 1.5, 1);
  });

  describe('Image Boundary Barriers for All Toolbar Elements', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;

    it('clamps rectangle/image positions strictly within [0, canvas - dimension]', () => {
      // Normal inside canvas
      expect(clampRectToBounds(50, 60, 100, 80, canvasWidth, canvasHeight)).toEqual({
        x: 50,
        y: 60,
      });

      // Drags beyond left/top
      expect(clampRectToBounds(-25, -40, 100, 80, canvasWidth, canvasHeight)).toEqual({
        x: 0,
        y: 0,
      });

      // Drags beyond right/bottom
      expect(clampRectToBounds(750, 550, 100, 80, canvasWidth, canvasHeight)).toEqual({
        x: 700,
        y: 520,
      });

      // Element wider than canvas stays at x: 0
      expect(clampRectToBounds(50, 50, 1000, 800, canvasWidth, canvasHeight)).toEqual({
        x: 0,
        y: 0,
      });

      // Rotação de 180 graus: a área delimitada é idêntica à de 0 graus (centro cx, cy)
      // Retângulo grande de 500x300 em canvas de 800x600: deve poder se mover livremente em [0, 300] e [0, 300]
      expect(clampRectToBounds(50, 50, 500, 300, canvasWidth, canvasHeight, 1, 1, 180)).toEqual({
        x: 50,
        y: 50,
      });
      // Arrastado além da borda esquerda/superior com 180 graus
      expect(clampRectToBounds(-100, -50, 500, 300, canvasWidth, canvasHeight, 1, 1, 180)).toEqual({
        x: 0,
        y: 0,
      });
      // Arrastado além da borda direita/inferior com 180 graus (maxX = 800 - 500 = 300, maxY = 600 - 300 = 300)
      expect(clampRectToBounds(500, 400, 500, 300, canvasWidth, canvasHeight, 1, 1, 180)).toEqual({
        x: 300,
        y: 300,
      });

      // Rotação de 90 graus (vertical): dimensões projetadas passam a ser 300 de largura e 500 de altura
      // Largura na tela = 300 (extentX = 150), altura na tela = 500 (extentY = 250)
      // Centro permitido: cx em [150, 650] (x em [-100, 400]), cy em [250, 350] (y em [100, 200])
      expect(clampRectToBounds(-200, 0, 500, 300, canvasWidth, canvasHeight, 1, 1, 90)).toEqual({
        x: -100,
        y: 100,
      });
      expect(clampRectToBounds(600, 500, 500, 300, canvasWidth, canvasHeight, 1, 1, 90)).toEqual({
        x: 400,
        y: 200,
      });
    });

    it('clamps ellipse positions strictly by radii from edges', () => {
      const rx = 50;
      const ry = 40;

      // Inside
      expect(clampEllipseToBounds(200, 200, rx, ry, canvasWidth, canvasHeight)).toEqual({
        x: 200,
        y: 200,
      });

      // Beyond left/top
      expect(clampEllipseToBounds(20, 10, rx, ry, canvasWidth, canvasHeight)).toEqual({
        x: 50,
        y: 40,
      });

      // Beyond right/bottom
      expect(clampEllipseToBounds(780, 590, rx, ry, canvasWidth, canvasHeight)).toEqual({
        x: 750,
        y: 560,
      });
    });

    it('converts an ellipse into a perfect circle adopting the largest radius and clamping to bounds', () => {
      // 1. Elipse com radiusY > radiusX no centro do canvas
      const tallEllipse = {
        x: 200,
        y: 200,
        radiusX: 40,
        radiusY: 90,
      };
      const circle1 = convertToPerfectCircle(tallEllipse, canvasWidth, canvasHeight);
      expect(circle1.radiusX).toBe(90);
      expect(circle1.radiusY).toBe(90);
      expect(circle1.x).toBe(200);
      expect(circle1.y).toBe(200);

      // 2. Elipse com radiusX > radiusY perto da borda direita: ao expandir radiusY para 100, deve reclampar x
      const wideNearEdge = {
        x: 750,
        y: 200,
        radiusX: 100,
        radiusY: 40,
      };
      const circle2 = convertToPerfectCircle(wideNearEdge, canvasWidth, canvasHeight);
      expect(circle2.radiusX).toBe(100);
      expect(circle2.radiusY).toBe(100);
      // canvasWidth é 800, então max x para raio 100 é 800 - 100 = 700
      expect(circle2.x).toBe(700);
      expect(circle2.y).toBe(200);
    });

    it('clamps line and arrow point offsets so all vertices remain on-canvas', () => {
      // Line from (100, 50) to (300, 250)
      const points = [100, 50, 300, 250];

      // With offset (0, 0), minX=100, maxX=300, minY=50, maxY=250 -> valid
      expect(clampLinePointsToBounds(0, 0, points, canvasWidth, canvasHeight)).toEqual({
        x: 0,
        y: 0,
      });

      // Dragging line to the left beyond edge (x offset -150 => minX would be -50)
      // Clamped x offset should be -100 so minX is exactly 0
      expect(clampLinePointsToBounds(-150, 0, points, canvasWidth, canvasHeight)).toEqual({
        x: -100,
        y: 0,
      });

      // Dragging line to the right beyond edge (x offset 600 => maxX would be 900 > 800)
      // Clamped x offset should be 800 - 300 = 500
      expect(clampLinePointsToBounds(600, 0, points, canvasWidth, canvasHeight)).toEqual({
        x: 500,
        y: 0,
      });

      // Dragging line up beyond edge (y offset -100 => minY would be -50)
      // Clamped y offset should be -50
      expect(clampLinePointsToBounds(0, -100, points, canvasWidth, canvasHeight)).toEqual({
        x: 0,
        y: -50,
      });

      // Dragging line down beyond edge (y offset 400 => maxY would be 650 > 600)
      // Clamped y offset should be 600 - 250 = 350
      expect(clampLinePointsToBounds(0, 400, points, canvasWidth, canvasHeight)).toEqual({
        x: 0,
        y: 350,
      });
    });

    it('clamps annotations dynamically through clampAnnotationPositionToBounds', () => {
      const rectAnn: Annotation = {
        id: '1',
        type: 'rect',
        x: 10,
        y: 10,
        width: 120,
        height: 80,
        stroke: '#ff0000',
        strokeWidth: 2,
      };
      expect(
        clampAnnotationPositionToBounds(rectAnn, 900, 800, canvasWidth, canvasHeight)
      ).toEqual({
        x: 800 - 120,
        y: 600 - 80,
      });

      const textAnn: Annotation = {
        id: '2',
        type: 'text',
        x: 50,
        y: 50,
        text: 'Teste',
        fontSize: 16,
        fill: '#000000',
      };
      // Measured node size 140x30
      expect(
        clampAnnotationPositionToBounds(textAnn, 750, 590, canvasWidth, canvasHeight, 140, 30)
      ).toEqual({
        x: 800 - 140,
        y: 600 - 30,
      });
    });

    it('transforms bounding boxes between local image coordinates and stage coordinates under zoom', () => {
      const zoom = 1.5;
      const absBox = { x: 150, y: 300, width: 450, height: 600, rotation: 15 };
      const localBox = toLocalBoundingBox(absBox, zoom);

      expect(localBox.x).toBe(100);
      expect(localBox.y).toBe(200);
      expect(localBox.width).toBe(300);
      expect(localBox.height).toBe(400);
      expect(localBox.rotation).toBe(15);

      const convertedBack = toAbsoluteBoundingBox(localBox, zoom);
      expect(convertedBack).toEqual(absBox);
    });

    it('calculates proportional resize box equally for horizontal and vertical resizing without distortion', () => {
      const oldBox = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };

      // Redimensionando pelas laterais ("para o lado"): largura aumentou de 200 para 300 (escala 1.5x)
      // A altura DEVE crescer na mesma proporção: 100 * 1.5 = 150
      const sideDrag = { x: 100, y: 100, width: 300, height: 100, rotation: 0 };
      const propSide = calculateProportionalResizeBox(oldBox, sideDrag);
      expect(propSide.width).toBe(300);
      expect(propSide.height).toBe(150);

      // Redimensionando pelo topo/fundo ("para cima"): altura aumentou de 100 para 200 (escala 2.0x)
      // A largura DEVE crescer na mesma proporção: 200 * 2.0 = 400
      const topDrag = { x: 100, y: 50, width: 200, height: 200, rotation: 0 };
      const propTop = calculateProportionalResizeBox(oldBox, topDrag);
      expect(propTop.width).toBe(400);
      expect(propTop.height).toBe(200);

      // Redimensionando pelos cantos com proporção idêntica
      const cornerDrag = { x: 100, y: 100, width: 400, height: 200, rotation: 0 };
      const propCorner = calculateProportionalResizeBox(oldBox, cornerDrag);
      expect(propCorner.width).toBe(400);
      expect(propCorner.height).toBe(200);
    });

    it('recognizes 100% of the image canvas area for scaled and rotated arrows/lines', () => {
      // Flecha com vetor base de 100px no eixo X: (0, 0) até (100, 0)
      const points = [0, 0, 100, 0];

      // Flecha escalada para 200px (scaleX: 2.0, scaleY: 2.0) sem rotação
      // O comprimento real é 200px. No canvas de 800px, x pode ir de 0 até 800 - 200 = 600
      const clampedScaled = clampLinePointsToBounds(
        750,
        100,
        points,
        canvasWidth,
        canvasHeight,
        2.0,
        2.0,
        0
      );
      expect(clampedScaled.x).toBe(600);
      expect(clampedScaled.y).toBe(100);

      // Flecha rotacionada em 90 graus (apontando para baixo) com escala 2x:
      // O vetor se estende 200px no eixo Y.
      // Em X pode ir até 800 (pois largura é 0), e em Y pode ir até 600 - 200 = 400
      const clampedRotated = clampLinePointsToBounds(
        800,
        550,
        points,
        canvasWidth,
        canvasHeight,
        2.0,
        2.0,
        90
      );
      expect(clampedRotated.x).toBe(800);
      expect(clampedRotated.y).toBe(400);

      // Mesmo que o elemento tenha sido distorcido previamente (scaleX: 2.5, scaleY: 0.5):
      // A flecha reconhece a área total real ocupada e permite navegar até o limite exato
      const clampedDistorted = clampLinePointsToBounds(
        700,
        100,
        points,
        canvasWidth,
        canvasHeight,
        2.5,
        0.5,
        0
      );
      // 100 * 2.5 = 250px de comprimento => limite X = 800 - 250 = 550
      expect(clampedDistorted.x).toBe(550);
      expect(clampedDistorted.y).toBe(100);
    });
  });

  describe('Arrow Geometry, Head Scaling and Stepped Resizing', () => {
    it('defines arrow stroke steps and snaps correctly between 2px and 8px', () => {
      expect(ARROW_DEFAULT_STROKE).toBe(4);
      expect(ARROW_STROKE_STEPS).toEqual([2, 3, 4, 6, 8]);

      expect(snapToArrowStrokeStep(1)).toBe(2);
      expect(snapToArrowStrokeStep(2)).toBe(2);
      expect(snapToArrowStrokeStep(2.8)).toBe(3);
      expect(snapToArrowStrokeStep(4.2)).toBe(4);
      expect(snapToArrowStrokeStep(5.6)).toBe(6);
      expect(snapToArrowStrokeStep(7.8)).toBe(8);
      expect(snapToArrowStrokeStep(15)).toBe(8);
    });

    it('calculates resized arrow stroke within bounds', () => {
      expect(calculateResizedArrowStroke(4, 1.0)).toBe(4);
      expect(calculateResizedArrowStroke(4, 0.5)).toBe(2);
      expect(calculateResizedArrowStroke(4, 1.5)).toBe(6);
      expect(calculateResizedArrowStroke(4, 2.0)).toBe(8);
      expect(calculateResizedArrowStroke(4, 5.0)).toBe(8);
      expect(calculateResizedArrowStroke(4, 0.1)).toBe(2);
    });

    it('calculates proportional head dimensions scaling with stroke to avoid distortion', () => {
      const standard4 = getArrowHeadDimensions(4, 'standard');
      expect(standard4.pointerLength).toBe(13);
      expect(standard4.pointerWidth).toBe(10);

      const standard8 = getArrowHeadDimensions(8, 'standard');
      expect(standard8.pointerLength).toBe(26);
      expect(standard8.pointerWidth).toBe(20);

      const thin2 = getArrowHeadDimensions(2, 'thin');
      expect(thin2.pointerLength).toBe(8);
      expect(thin2.pointerWidth).toBe(6);
    });

    it('calculates curved arrow points with perpendicular offset for smooth arc', () => {
      // Vetor horizontal de (100, 100) para (200, 100). Corda de 100px.
      const curvedRight = calculateCurvedArrowPoints(100, 100, 200, 100, 'right');
      expect(curvedRight).toHaveLength(6);
      expect(curvedRight[0]).toBe(100);
      expect(curvedRight[1]).toBe(100);
      expect(curvedRight[4]).toBe(200);
      expect(curvedRight[5]).toBe(100);
      // Ponto médio da corda é X=150, Y=100. Vetor normal aponta para baixo (+Y para 'right')
      expect(curvedRight[2]).toBe(150);
      expect(curvedRight[3]).toBeGreaterThan(100);

      const curvedLeft = calculateCurvedArrowPoints(100, 100, 200, 100, 'left');
      expect(curvedLeft[2]).toBe(150);
      expect(curvedLeft[3]).toBeLessThan(100);

      // Distâncias perpendiculares de left e right são opostas e simétricas
      const diffRight = curvedRight[3] - 100;
      const diffLeft = 100 - curvedLeft[3];
      expect(diffRight).toBe(diffLeft);

      // Clique sem arrastar (comprimento zero) não gera NaN nem Infinity
      const zeroLength = calculateCurvedArrowPoints(50, 50, 50, 50);
      expect(zeroLength).toEqual([50, 50, 50, 50, 50, 50]);
    });

    it('inverts curved arrow points mirroring the mid-point across chord', () => {
      const original = calculateCurvedArrowPoints(100, 100, 300, 100, 'right');
      const inverted = invertCurvedArrowPoints(original);

      expect(inverted[0]).toBe(original[0]);
      expect(inverted[1]).toBe(original[1]);
      expect(inverted[4]).toBe(original[4]);
      expect(inverted[5]).toBe(original[5]);

      // O ponto médio espelhado: (original[3] + inverted[3]) / 2 === corda Y (100)
      expect((original[3] + inverted[3]) / 2).toBe(100);
    });

    it('clamps transformer resize box in stepped increments between 2px and 8px', () => {
      const oldBox = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };
      // Dobrar de tamanho (escala 2.0x => 4px * 2.0 = 8px)
      const expandedBox = { x: 100, y: 100, width: 400, height: 200, rotation: 0 };
      const clampedExpanded = clampArrowResizeBox(oldBox, expandedBox, 4, 200, 100);

      // Deve atingir o degrau 8 (escala 8/4 = 2.0x)
      expect(clampedExpanded.width).toBe(400);
      expect(clampedExpanded.height).toBe(200);

      // Tentar expandir 4x (excederia 8px): trava no limite máximo 8px (escala 2x)
      const overExpandedBox = { x: 100, y: 100, width: 800, height: 400, rotation: 0 };
      const clampedMax = clampArrowResizeBox(oldBox, overExpandedBox, 4, 200, 100);
      expect(clampedMax.width).toBe(400);
      expect(clampedMax.height).toBe(200);

      // Tentar reduzir abaixo de 2px (ex: 0.1x): trava no limite mínimo 2px (escala 2/4 = 0.5x)
      const overShrunkBox = { x: 100, y: 100, width: 20, height: 10, rotation: 0 };
      const clampedMin = clampArrowResizeBox(oldBox, overShrunkBox, 4, 200, 100);
      expect(clampedMin.width).toBe(100);
      expect(clampedMin.height).toBe(50);
    });

    it('suppresses transformer for rect, ellipse, line and arrow (using native snipping tool handles)', () => {
      // Elementos que usam âncoras dedicadas estilo Snipping Tool NÃO acoplam Transformer
      expect(shouldAttachTransformer('rect')).toBe(false);
      expect(shouldAttachTransformer('ellipse')).toBe(false);
      expect(shouldAttachTransformer('line')).toBe(false);
      expect(shouldAttachTransformer('arrow')).toBe(false);
      expect(shouldAttachTransformer('arrow', 'standard')).toBe(false);
      expect(shouldAttachTransformer('arrow', 'thin')).toBe(false);
      expect(shouldAttachTransformer('arrow', 'dashed')).toBe(false);
      expect(shouldAttachTransformer('arrow', 'curved')).toBe(false);

      // Texto, imagem, crop e multi continuam usando Transformer
      expect(shouldAttachTransformer('text')).toBe(false);
      expect(shouldAttachTransformer('image')).toBe(true);
      expect(shouldAttachTransformer('crop')).toBe(true);
      expect(shouldAttachTransformer('multi')).toBe(true);

      // Ferramenta select não acopla
      expect(shouldAttachTransformer('select')).toBe(false);
    });

    it('calculates 4-corner positions and rotation handle for rect and ellipse', () => {
      const rectAnn: Annotation = {
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 0,
      };

      const rectCorners = getFourCornerPositions(rectAnn);
      expect(rectCorners.corners[0]).toEqual({ x: 100, y: 100 }); // TL
      expect(rectCorners.corners[1]).toEqual({ x: 300, y: 100 }); // TR
      expect(rectCorners.corners[2]).toEqual({ x: 300, y: 200 }); // BR
      expect(rectCorners.corners[3]).toEqual({ x: 100, y: 200 }); // BL
      expect(rectCorners.center).toEqual({ x: 200, y: 150 });
      expect(rectCorners.rotater).toEqual({ x: 200, y: 72 }); // 100 - 28

      const ellipseAnn: Annotation = {
        id: 'e1',
        type: 'ellipse',
        x: 200,
        y: 200,
        radiusX: 50,
        radiusY: 30,
        stroke: '#00ff00',
        strokeWidth: 4,
        rotation: 0,
      };

      const ellipseCorners = getFourCornerPositions(ellipseAnn);
      expect(ellipseCorners.corners[0]).toEqual({ x: 150, y: 170 }); // TL
      expect(ellipseCorners.corners[1]).toEqual({ x: 250, y: 170 }); // TR
      expect(ellipseCorners.corners[2]).toEqual({ x: 250, y: 230 }); // BR
      expect(ellipseCorners.corners[3]).toEqual({ x: 150, y: 230 }); // BL
      expect(ellipseCorners.center).toEqual({ x: 200, y: 200 });
      expect(ellipseCorners.rotater).toEqual({ x: 200, y: 142 }); // 170 - 28
    });

    it('resizes rect keeping opposite corner firmly anchored', () => {
      const rectAnn: Annotation = {
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 0,
      };

      // Arrastar BR (canto inferior direito, index 2) para a direita e para baixo
      // O canto oposto TL (100, 100) DEVE ficar ancorado!
      const updatedBR = updateCornerResize(rectAnn, 2, { x: 350, y: 250 }, 800, 600);
      expect(updatedBR).toEqual({
        x: 100,
        y: 100,
        width: 250,
        height: 150,
      });

      // Arrastar TR (canto superior direito, index 1) para cima
      // O canto oposto BL (100, 200) DEVE ficar ancorado!
      const updatedTR = updateCornerResize(rectAnn, 1, { x: 350, y: 80 }, 800, 600);
      expect(updatedTR).toEqual({
        x: 100,
        y: 80,
        width: 250,
        height: 120,
      });

      // Arrastar BL (canto inferior esquerdo, index 3) para a esquerda
      // O canto oposto TR (300, 100) DEVE ficar ancorado!
      const updatedBL = updateCornerResize(rectAnn, 3, { x: 80, y: 250 }, 800, 600);
      expect(updatedBL).toEqual({
        x: 80,
        y: 100,
        width: 220,
        height: 150,
      });

      // Arrastar TL (canto superior esquerdo, index 0)
      // O canto oposto BR (300, 200) DEVE ficar ancorado!
      const updatedTL = updateCornerResize(rectAnn, 0, { x: 80, y: 80 }, 800, 600);
      expect(updatedTL).toEqual({
        x: 80,
        y: 80,
        width: 220,
        height: 120,
      });
    });

    it('resizes rotated rectangle keeping opposite corner firmly anchored and respecting image area', () => {
      // Retângulo com rotação 180 graus:
      // x: 100, y: 100, width: 200, height: 100. Centro inicial: (200, 150).
      // Com rotação 180°: BR inicial está em (100, 100), TL inicial está em (300, 200).
      const rect180: Annotation = {
        id: 'r180',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 2,
        rotation: 180,
      };

      // Arrastar TL (corner 0) de (300, 200) para (400, 250):
      // O canto oposto BR (100, 100) DEVE ficar estritamente ancorado!
      const updated180 = updateCornerResize(rect180, 0, { x: 400, y: 250 }, 800, 600) as {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
      };
      expect(updated180.width).toBe(300);
      expect(updated180.height).toBe(150);
      // O centro do novo retângulo é (250, 175) -> x: 250 - 150 = 100, y: 175 - 75 = 100
      expect(updated180.x).toBe(100);
      expect(updated180.y).toBe(100);

      // Verifica com getFourCornerPositions que o canto BR continua exatamente em (100, 100)
      const cornersAfter = getFourCornerPositions({
        ...rect180,
        ...updated180,
        type: 'rect',
        width: updated180.width!,
        height: updated180.height!,
      });
      // Canto BR (index 2) deve ser (100, 100)
      expect(cornersAfter.corners[2].x).toBeCloseTo(100, 0);
      expect(cornersAfter.corners[2].y).toBeCloseTo(100, 0);
      // Canto TL (index 0) deve ser (400, 250)
      expect(cornersAfter.corners[0].x).toBeCloseTo(400, 0);
      expect(cornersAfter.corners[0].y).toBeCloseTo(250, 0);
    });

    it('resizes ellipse keeping opposite boundary firmly anchored', () => {
      const ellipseAnn: Annotation = {
        id: 'e1',
        type: 'ellipse',
        x: 200,
        y: 200,
        radiusX: 50,
        radiusY: 30,
        stroke: '#00ff00',
        strokeWidth: 4,
        rotation: 0,
      };

      // Arrastar BR (index 2): TL oposto estava em (150, 170)
      // Arrastar para (280, 250): largura 130, altura 80 -> radiusX 65, radiusY 40, centro (215, 210)
      const updatedBR = updateCornerResize(ellipseAnn, 2, { x: 280, y: 250 }, 800, 600);
      expect(updatedBR).toEqual({
        x: 215,
        y: 210,
        radiusX: 65,
        radiusY: 40,
      });
    });

    it('calculates 360-degree rotation angle around shape center smoothly', () => {
      const rectAnn: Annotation = {
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 0,
      };

      // Centro é (200, 150).
      // Cursor diretamente acima (200, 50): 0 graus
      expect(updateShapeRotation(rectAnn, { x: 200, y: 50 })).toBeCloseTo(0, 0);

      // Cursor diretamente à direita (300, 150): 90 graus
      expect(updateShapeRotation(rectAnn, { x: 300, y: 150 })).toBeCloseTo(90, 0);

      // Cursor diretamente abaixo (200, 250): 180 graus
      expect(updateShapeRotation(rectAnn, { x: 200, y: 250 })).toBeCloseTo(180, 0);

      // Cursor diretamente à esquerda (100, 150): 270 graus
      expect(updateShapeRotation(rectAnn, { x: 100, y: 150 })).toBeCloseTo(270, 0);
    });

    it('maintains 4 corners and rotater perfectly centered and attached under 90 degrees rotation', () => {
      const rectAnn: Annotation = {
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 90,
      };

      const corners90 = getFourCornerPositions(rectAnn);
      expect(corners90.center).toEqual({ x: 200, y: 150 });
      expect(corners90.rotater.x).toBeCloseTo(278, 0);
      expect(corners90.rotater.y).toBeCloseTo(150, 0);
    });

    it('keeps all 4 corners and rotater equidistant from center under any 360 degree rotation angle', () => {
      const baseAnn: Annotation = {
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 0,
      };

      const c0 = getFourCornerPositions(baseAnn);
      const expectedCornerDist = Math.hypot(c0.corners[0].x - c0.center.x, c0.corners[0].y - c0.center.y);
      const expectedRotaterDist = Math.hypot(c0.rotater.x - c0.center.x, c0.rotater.y - c0.center.y);

      for (const angle of [0, 30, 45, 90, 135, 180, 225, 270, 315, 360]) {
        const rotated = getFourCornerPositions({ ...baseAnn, rotation: angle });
        expect(rotated.center).toEqual({ x: 200, y: 150 });
        for (let i = 0; i < 4; i++) {
          const dist = Math.hypot(rotated.corners[i].x - rotated.center.x, rotated.corners[i].y - rotated.center.y);
          expect(dist).toBeCloseTo(expectedCornerDist, 0);
        }
        const rotaterDist = Math.hypot(rotated.rotater.x - rotated.center.x, rotated.rotater.y - rotated.center.y);
        expect(rotaterDist).toBeCloseTo(expectedRotaterDist, 0);
      }
    });

    it('shifts all 4 corners and rotater when moving element center during drag', () => {
      const movedAnn: Annotation = {
        id: 'r1',
        type: 'rect',
        x: 250, // shifted +150
        y: 180, // shifted +80
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 45,
      };

      const moved = getFourCornerPositions(movedAnn);
      expect(moved.center).toEqual({ x: 350, y: 230 });
      // Verify rotater is shifted consistently by (150, 80)
      const baseAt45 = getFourCornerPositions({
        id: 'r1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        stroke: '#ff0000',
        strokeWidth: 4,
        rotation: 45,
      });
      expect(moved.rotater.x).toBeCloseTo(baseAt45.rotater.x + 150, 4);
      expect(moved.rotater.y).toBeCloseTo(baseAt45.rotater.y + 80, 4);
    });

    it('extracts and updates 2-point anchor positions for line and straight arrows respecting image bounds', () => {
      const initialPoints = [50, 60, 200, 180];
      const anchors = getTwoPointAnchorPositions(initialPoints);

      expect(anchors.start).toEqual({ x: 50, y: 60 });
      expect(anchors.end).toEqual({ x: 200, y: 180 });

      // Atualiza âncora 0 (origem/cauda)
      const updatedStart = updateTwoPointAnchor(initialPoints, 0, 30, 40, 800, 600);
      expect(updatedStart).toEqual([30, 40, 200, 180]);

      // Atualiza âncora 1 (destino/ponta)
      const updatedEnd = updateTwoPointAnchor(initialPoints, 1, 250, 220, 800, 600);
      expect(updatedEnd).toEqual([50, 60, 250, 220]);

      // Clamping aos limites da imagem: arrastar além dos limites trava em 0 e canvasLimit
      const clampedOutOfBounds = updateTwoPointAnchor(initialPoints, 1, 999, -50, 800, 600);
      expect(clampedOutOfBounds[2]).toBe(800);
      expect(clampedOutOfBounds[3]).toBe(0);
    });

    it('extracts and updates curved arrow anchor positions respecting image bounds', () => {
      const initialPoints = [100, 100, 200, 50, 300, 100];
      const anchors = getCurvedArrowAnchorPositions(initialPoints);

      expect(anchors.tail).toEqual({ x: 100, y: 100 });
      expect(anchors.bend).toEqual({ x: 200, y: 50 });
      expect(anchors.tip).toEqual({ x: 300, y: 100 });

      // Atualiza âncora 0 (cauda)
      const updatedTail = updateCurvedArrowAnchor(initialPoints, 0, 80, 120, 800, 600);
      expect(updatedTail).toEqual([80, 120, 200, 50, 300, 100]);

      // Atualiza âncora 1 (arco/meio)
      const updatedBend = updateCurvedArrowAnchor(initialPoints, 1, 200, 180, 800, 600);
      expect(updatedBend).toEqual([100, 100, 200, 180, 300, 100]);

      // Atualiza âncora 2 (ponta)
      const updatedTip = updateCurvedArrowAnchor(initialPoints, 2, 350, 90, 800, 600);
      expect(updatedTip).toEqual([100, 100, 200, 50, 350, 90]);

      // Clamping aos limites da imagem: tentar arrastar para fora da tela (ex: -50 ou 1000) trava em 0 e canvasLimit
      const clampedOutOfBounds = updateCurvedArrowAnchor(initialPoints, 2, 1000, -20, 800, 600);
      expect(clampedOutOfBounds[4]).toBe(800);
      expect(clampedOutOfBounds[5]).toBe(0);
    });

    it('returns appropriate diagonal double-arrow resize cursors for unrotated shapes (0 degrees)', () => {
      // TL (index 0) e BR (index 2) -> nwse-resize (↖↘)
      expect(getCornerCursor(0, 0)).toBe('nwse-resize');
      expect(getCornerCursor(2, 0)).toBe('nwse-resize');

      // TR (index 1) e BL (index 3) -> nesw-resize (↗↙)
      expect(getCornerCursor(1, 0)).toBe('nesw-resize');
      expect(getCornerCursor(3, 0)).toBe('nesw-resize');
    });

    it('adjusts double-arrow resize cursors smoothly when shape is rotated', () => {
      // Ao girar 90 graus:
      // Canto TL (0) passa para posição TR -> nesw-resize
      expect(getCornerCursor(0, 90)).toBe('nesw-resize');
      // Canto TR (1) passa para posição BR -> nwse-resize
      expect(getCornerCursor(1, 90)).toBe('nwse-resize');
      // Canto BR (2) passa para posição BL -> nesw-resize
      expect(getCornerCursor(2, 90)).toBe('nesw-resize');
      // Canto BL (3) passa para posição TL -> nwse-resize
      expect(getCornerCursor(3, 90)).toBe('nwse-resize');
    });

    it('snaps rotation angles to 15-degree steps and wraps 360 to 0', () => {
      expect(snapAngleToStep(0, 15)).toBe(0);
      expect(snapAngleToStep(2, 15)).toBe(0);
      expect(snapAngleToStep(14, 15)).toBe(15);
      expect(snapAngleToStep(16, 15)).toBe(15);
      expect(snapAngleToStep(88, 15)).toBe(90);
      expect(snapAngleToStep(179, 15)).toBe(180);
      expect(snapAngleToStep(268, 15)).toBe(270);
      expect(snapAngleToStep(358, 15)).toBe(0);
      expect(snapAngleToStep(360, 15)).toBe(0);
    });

    it('snaps line/arrow points to perfectly straight horizontal, vertical or 45-degree diagonal with Shift', () => {
      const startX = 100;
      const startY = 100;

      // 1. Quase horizontal para a direita: trava em y = startY (horizontal perfeita)
      const nearHorizRight = snapLinePointsWithShift(startX, startY, 250, 108);
      expect(nearHorizRight).toEqual({ x: 250, y: 100 });

      // 2. Quase horizontal para a esquerda: trava em y = startY
      const nearHorizLeft = snapLinePointsWithShift(startX, startY, 20, 94);
      expect(nearHorizLeft).toEqual({ x: 20, y: 100 });

      // 3. Quase vertical para baixo: trava em x = startX (vertical perfeita)
      const nearVertDown = snapLinePointsWithShift(startX, startY, 106, 260);
      expect(nearVertDown).toEqual({ x: 100, y: 260 });

      // 4. Quase vertical para cima: trava em x = startX
      const nearVertUp = snapLinePointsWithShift(startX, startY, 95, 30);
      expect(nearVertUp).toEqual({ x: 100, y: 30 });

      // 5. Diagonal próxima a 45 graus (baixo-direita): dx === dy
      const nearDiag = snapLinePointsWithShift(startX, startY, 200, 192); // dx=100, dy=92
      expect(nearDiag).toEqual({ x: 200, y: 200 });
    });

    it('snaps rectangle to perfect 1:1 square dimensions with Shift preserving direction', () => {
      // Arrastando para baixo-direita
      const sqDownRight = snapRectWithShift(100, 100, 220, 170); // dx=120, dy=70
      expect(sqDownRight).toEqual({ width: 120, height: 120 });

      // Arrastando para cima-esquerda
      const sqUpLeft = snapRectWithShift(200, 200, 150, 120); // dx=-50, dy=-80
      expect(sqUpLeft).toEqual({ width: -80, height: -80 });
    });

    it('calculates two-point anchor drag bound clamping to canvas and locking straight axis when Shift is held', () => {
      const fixedPoint = { x: 100, y: 100 };
      const canvasWidth = 800;
      const canvasHeight = 600;

      // Sem shift: livre para seguir o mouse (apenas com clamp de canvas)
      const freeDrag = getTwoPointAnchorDragBound(250, 115, fixedPoint, false, canvasWidth, canvasHeight);
      expect(freeDrag).toEqual({ x: 250, y: 115 });

      // Com shift: quase horizontal para a direita trava estritamente em y = 100
      const shiftedHoriz = getTwoPointAnchorDragBound(250, 115, fixedPoint, true, canvasWidth, canvasHeight);
      expect(shiftedHoriz).toEqual({ x: 250, y: 100 });

      // Com shift: quase vertical para baixo trava estritamente em x = 100
      const shiftedVert = getTwoPointAnchorDragBound(110, 300, fixedPoint, true, canvasWidth, canvasHeight);
      expect(shiftedVert).toEqual({ x: 100, y: 300 });

      // Com clamp nos limites do canvas quando arrastado para fora
      const clampedShifted = getTwoPointAnchorDragBound(900, 105, fixedPoint, true, canvasWidth, canvasHeight);
      expect(clampedShifted).toEqual({ x: 800, y: 100 });
    });

    it('calculates open chevron arrow points matching Lucide arrow icon geometry', () => {
      // 1. Flecha horizontal para a direita (0, 0) -> (100, 0) com strokeWidth 2
      const horiz = getOpenChevronArrowPoints(0, 0, 100, 0, 2);
      expect(horiz.shaftPoints).toEqual([0, 0, 100, 0]);
      // barbLength = max(8, 2 * 3.8) = 8
      // Ponta do chevron é (100, 0) no índice 2, 3
      expect(horiz.chevronPoints[2]).toBe(100);
      expect(horiz.chevronPoints[3]).toBe(0);
      // As abas devem recuar em X (x < 100) e ter aberturas simétricas em Y (+y e -y)
      const [x1, y1, tipX, tipY, x2, y2] = horiz.chevronPoints;
      expect(tipX).toBe(100);
      expect(tipY).toBe(0);
      expect(x1).toBeCloseTo(100 - 8 * Math.cos(Math.PI / 4), 4);
      expect(y1).toBeCloseTo(8 * Math.sin(Math.PI / 4), 4);
      expect(x2).toBeCloseTo(100 - 8 * Math.cos(Math.PI / 4), 4);
      expect(y2).toBeCloseTo(-8 * Math.sin(Math.PI / 4), 4);

      // 2. Flecha vertical para baixo (0, 0) -> (0, 100)
      const vert = getOpenChevronArrowPoints(0, 0, 0, 100, 2);
      expect(vert.shaftPoints).toEqual([0, 0, 0, 100]);
      expect(vert.chevronPoints[2]).toBe(0);
      expect(vert.chevronPoints[3]).toBe(100);
      // Abas recuam para cima (y < 100) e abrem simetricamente em X
      expect(vert.chevronPoints[1]).toBeLessThan(100);
      expect(vert.chevronPoints[5]).toBeLessThan(100);
      expect(Math.abs(vert.chevronPoints[0])).toBeCloseTo(Math.abs(vert.chevronPoints[4]), 4);

      // 3. Flecha degenerada de comprimento zero (50, 50) -> (50, 50)
      const degen = getOpenChevronArrowPoints(50, 50, 50, 50, 2);
      expect(degen.shaftPoints).toEqual([50, 50, 50, 50]);
      expect(degen.chevronPoints.every(n => Number.isFinite(n) && !Number.isNaN(n))).toBe(true);

      // 4. Proporção das abas com strokeWidth (2px, 4px, 8px)
      const p2 = getOpenChevronArrowPoints(0, 0, 100, 0, 2);
      const p4 = getOpenChevronArrowPoints(0, 0, 100, 0, 4);
      const p8 = getOpenChevronArrowPoints(0, 0, 100, 0, 8);

      const len2 = Math.hypot(p2.chevronPoints[0] - p2.chevronPoints[2], p2.chevronPoints[1] - p2.chevronPoints[3]);
      const len4 = Math.hypot(p4.chevronPoints[0] - p4.chevronPoints[2], p4.chevronPoints[1] - p4.chevronPoints[3]);
      const len8 = Math.hypot(p8.chevronPoints[0] - p8.chevronPoints[2], p8.chevronPoints[1] - p8.chevronPoints[3]);

      expect(len2).toBeCloseTo(8, 2); // max(8, 7.6) = 8
      expect(len4).toBeCloseTo(4 * 3.8, 2); // 15.2
      expect(len8).toBeCloseTo(8 * 3.8, 2); // 30.4
    });

    it('computes four corner positions and rotation handle for text annotations', () => {
      const textAnn: Annotation = {
        id: 't1',
        type: 'text',
        x: 100,
        y: 100,
        text: 'Hello World',
        fontSize: 20,
        width: 200,
        rotation: 0,
      };
      const controls = getFourCornerPositions(textAnn);
      expect(controls.corners).toHaveLength(4);
      expect(controls.rotater).toBeDefined();
      expect(controls.center.x).toBeGreaterThan(100);
      expect(controls.center.y).toBeGreaterThan(100);
      expect(controls.rotater.y).toBeLessThan(100);
    });

    it('resizes text annotation width and enables autoWrap when dragging corner', () => {
      const textAnn: Annotation = {
        id: 't1',
        type: 'text',
        x: 100,
        y: 100,
        text: 'Hello World',
        fontSize: 20,
        width: 200,
        rotation: 0,
      };
      const res = updateCornerResize(textAnn, 2, { x: 350, y: 150 }, 800, 600) as any;
      expect(res.width).toBe(250);
      expect(res.autoWrap).toBe(true);
    });
  });
});
