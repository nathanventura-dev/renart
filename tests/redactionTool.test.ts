// tests/redactionTool.test.ts
import { describe, it, expect } from 'vitest';
import {
  createRedactionRect,
  createRedactionBrush,
  clampRedactionRectToBounds,
} from '../src/utils/redaction';
import {
  getFourCornerPositions,
  updateCornerResize,
  updateShapeRotation,
} from '../src/utils/zoomAndCrop';

describe('Redaction & Blur Tool Logic', () => {
  it('creates rect redaction with correct bounding box and properties', () => {
    const ann = createRedactionRect(10, 20, 100, 50, 'blackout', 'redact-1');
    expect(ann.id).toBe('redact-1');
    expect(ann.type).toBe('redaction');
    expect(ann.effect).toBe('blackout');
    expect(ann.mode).toBe('rect');
    expect(ann.x).toBe(10);
    expect(ann.y).toBe(20);
    expect(ann.width).toBe(100);
    expect(ann.height).toBe(50);
  });

  it('creates brush redaction with points array and brush size', () => {
    const ann = createRedactionBrush([10, 10, 20, 20, 30, 25], 'blur', 24, 'redact-2');
    expect(ann.id).toBe('redact-2');
    expect(ann.type).toBe('redaction');
    expect(ann.effect).toBe('blur');
    expect(ann.mode).toBe('brush');
    expect(ann.points).toEqual([10, 10, 20, 20, 30, 25]);
    expect(ann.brushSize).toBe(24);
  });

  it('clamps rect redaction to image bounds correctly', () => {
    // Caso 1: Dentro dos limites
    const normal = clampRedactionRectToBounds(10, 20, 100, 50, 800, 600);
    expect(normal.x).toBe(10);
    expect(normal.y).toBe(20);
    expect(normal.width).toBe(100);
    expect(normal.height).toBe(50);

    // Caso 2: Coordenadas negativas
    const negative = clampRedactionRectToBounds(-20, -10, 100, 50, 800, 600);
    expect(negative.x).toBe(0);
    expect(negative.y).toBe(0);
    expect(negative.width).toBe(80);

    // Caso 3: Ultrapassa largura e altura da imagem
    const overflow = clampRedactionRectToBounds(750, 580, 100, 50, 800, 600);
    expect(overflow.x).toBe(750);
    expect(overflow.y).toBe(580);
    expect(overflow.width).toBe(50);
    expect(overflow.height).toBe(20);
  });

  it('computes 4-corner positions for rect redactions correctly', () => {
    const ann = createRedactionRect(100, 100, 200, 100, 'blackout', 'redact-4c');
    const controls = getFourCornerPositions(ann);
    expect(controls.center).toEqual({ x: 200, y: 150 });
    expect(controls.corners[0]).toEqual({ x: 100, y: 100 });
    expect(controls.corners[1]).toEqual({ x: 300, y: 100 });
    expect(controls.corners[2]).toEqual({ x: 300, y: 200 });
    expect(controls.corners[3]).toEqual({ x: 100, y: 200 });
  });

  it('resizes rect redactions with corner drag correctly', () => {
    const ann = createRedactionRect(100, 100, 200, 100, 'blur', 'redact-resize');
    // Arrastar canto inferior direito (cornerIndex = 2) para (350, 250)
    const updated = updateCornerResize(ann, 2, { x: 350, y: 250 }, 800, 600) as { width?: number; height?: number; x?: number; y?: number };
    expect(updated.width).toBe(250);
    expect(updated.height).toBe(150);
    expect(updated.x).toBe(100);
    expect(updated.y).toBe(100);
  });

  it('computes rotation for rect redaction correctly', () => {
    const ann = createRedactionRect(100, 100, 200, 100, 'blur', 'redact-rot');
    // Centro: (200, 150). Alça superior não rotacionada está em (200, 72)
    // Se o ponteiro for para a direita do centro (300, 150): ângulo deve ser 90 graus
    const angle = updateShapeRotation(ann, { x: 300, y: 150 });
    expect(angle).toBe(90);
  });
});
