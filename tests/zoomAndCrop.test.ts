import { describe, it, expect } from 'vitest';
import {
  calculateFitToScreenScale,
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
  clampLinePointsToBounds,
  clampAnnotationPositionToBounds,
  toLocalBoundingBox,
  toAbsoluteBoundingBox,
  calculateProportionalResizeBox,
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
});
