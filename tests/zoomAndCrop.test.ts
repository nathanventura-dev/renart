import { describe, it, expect } from 'vitest';
import {
  calculateFitToScreenScale,
  clampZoomLevel,
  getNextZoomStep,
  calculateCropBounds,
  adjustAnnotationsForCrop,
  ZOOM_PRESETS,
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
