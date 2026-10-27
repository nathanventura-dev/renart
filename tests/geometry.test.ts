// tests/geometry.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNormalizedRect, simplifyFreeformPath, clampPointToScreen } from '../src/utils/geometry';

describe('Geometry Utils', () => {
  it('normalizes drag rectangle when dragging top-left to bottom-right', () => {
    const rect = calculateNormalizedRect({ x: 50, y: 30 }, { x: 200, y: 150 });
    expect(rect).toEqual({ x: 50, y: 30, width: 150, height: 120 });
  });

  it('normalizes drag rectangle when dragging bottom-right to top-left (inverted)', () => {
    const rect = calculateNormalizedRect({ x: 200, y: 150 }, { x: 50, y: 30 });
    expect(rect).toEqual({ x: 50, y: 30, width: 150, height: 120 });
  });

  it('normalizes drag rectangle with negative dimensions or reverse X', () => {
    const rect = calculateNormalizedRect({ x: 200, y: 30 }, { x: 50, y: 150 });
    expect(rect).toEqual({ x: 50, y: 30, width: 150, height: 120 });
  });

  it('clamps point to screen bounds', () => {
    const clamped = clampPointToScreen({ x: -10, y: 1200 }, 1920, 1080);
    expect(clamped).toEqual({ x: 0, y: 1080 });
  });

  it('simplifies freeform path by filtering redundant close points', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 11, y: 10 }, // muito próximo (distância < 3)
      { x: 20, y: 20 },
      { x: 50, y: 50 },
    ];
    const simplified = simplifyFreeformPath(points, 3);
    expect(simplified.length).toBe(3);
    expect(simplified[0]).toEqual({ x: 10, y: 10 });
    expect(simplified[1]).toEqual({ x: 20, y: 20 });
    expect(simplified[2]).toEqual({ x: 50, y: 50 });
  });
});
