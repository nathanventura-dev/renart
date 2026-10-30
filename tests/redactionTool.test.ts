// tests/redactionTool.test.ts
import { describe, it, expect } from 'vitest';
import {
  createRedactionRect,
  createRedactionBrush,
  clampRedactionRectToBounds,
} from '../src/utils/redaction';

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
});
