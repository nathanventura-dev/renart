import { describe, it, expect } from 'vitest';
import { calculateSmartTextLayout } from '../src/utils/smartTextLayout';
import { AnonymizedLine } from '../src/utils/textAnonymizer';

describe('Smart Text Layout & Rendering Helpers', () => {
  const mockLines: AnonymizedLine[] = [
    {
      text: 'Original Text Line 1',
      replacementText: 'Synthetic Line One',
      x: 100,
      y: 100,
      width: 200,
      height: 24,
      words: [],
    },
    {
      text: 'Original Text Line 2',
      replacementText: 'Second Line Content',
      x: 100,
      y: 130,
      width: 180,
      height: 24,
      words: [],
    },
  ];

  it('calculates local coordinates relative to parent bounding box without scaling', () => {
    const parentBox = { x: 100, y: 100, width: 220, height: 60 };
    const originalBox = { x: 100, y: 100, width: 220, height: 60 };

    const layout = calculateSmartTextLayout(mockLines, parentBox, originalBox);

    expect(layout).toHaveLength(2);
    expect(layout[0].x).toBe(0); // 100 - 100
    expect(layout[0].y).toBe(0); // 100 - 100
    expect(layout[0].width).toBe(200);
    expect(layout[0].height).toBe(24);
    expect(layout[0].fontSize).toBe(18); // 24 * 0.75
    expect(layout[0].text).toBe('Synthetic Line One');

    expect(layout[1].x).toBe(0);
    expect(layout[1].y).toBe(30); // 130 - 100
    expect(layout[1].text).toBe('Second Line Content');
  });

  it('scales line positions and font sizes when parent bounding box is resized', () => {
    const originalBox = { x: 100, y: 100, width: 200, height: 60 };
    // Resized to 2x width and 2x height
    const resizedBox = { x: 100, y: 100, width: 400, height: 120 };

    const layout = calculateSmartTextLayout(mockLines, resizedBox, originalBox);

    expect(layout).toHaveLength(2);
    expect(layout[0].width).toBe(400); // 200 * 2
    expect(layout[0].height).toBe(48); // 24 * 2
    expect(layout[0].fontSize).toBe(36); // 48 * 0.75
    expect(layout[1].y).toBe(60); // 30 * 2
  });

  it('returns empty array when lines is empty or undefined', () => {
    const box = { x: 0, y: 0, width: 100, height: 50 };
    expect(calculateSmartTextLayout(undefined, box, box)).toEqual([]);
    expect(calculateSmartTextLayout([], box, box)).toEqual([]);
  });
});
