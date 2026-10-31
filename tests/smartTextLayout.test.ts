import { describe, it, expect } from 'vitest';
import {
  calculateSmartTextLayout,
  calculateSmartTextWordLayout,
} from '../src/utils/smartTextLayout';
import { AnonymizedLine } from '../src/utils/textAnonymizer';

describe('Smart Text Layout Calculator', () => {
  const sampleLines: AnonymizedLine[] = [
    {
      text: 'R$ 1.500,00',
      replacementText: 'R$ 4.820,00',
      x: 100,
      y: 200,
      width: 90,
      height: 24,
      words: [
        {
          text: 'R$',
          originalText: 'R$',
          replacementText: 'R$',
          tokenType: 'currency',
          x: 100,
          y: 200,
          width: 25,
          height: 24,
        },
        {
          text: '1.500,00',
          originalText: '1.500,00',
          replacementText: '4.820,00',
          tokenType: 'currency',
          x: 130,
          y: 200,
          width: 60,
          height: 24,
        },
      ],
    },
  ];

  it('calculates word-level layout with exact bounding boxes relative to annotation origin', () => {
    const words = calculateSmartTextWordLayout(
      sampleLines,
      { x: 100, y: 200, width: 90, height: 24 },
      { x: 100, y: 200, width: 90, height: 24 }
    );

    expect(words).toHaveLength(2);
    expect(words[0].text).toBe('R$');
    expect(words[0].x).toBe(0); // 100 - 100 = 0
    expect(words[0].y).toBe(0); // 200 - 200 = 0
    expect(words[0].width).toBe(25);
    expect(words[0].height).toBe(24);
    expect(words[0].fontSize).toBeGreaterThanOrEqual(14);

    expect(words[1].text).toBe('4.820,00');
    expect(words[1].x).toBe(30); // 130 - 100 = 30
    expect(words[1].y).toBe(0);
    expect(words[1].width).toBe(60);
  });

  it('scales word layout proportionally when annotation is resized', () => {
    // Scaled to 2x width (180) and 2x height (48)
    const words = calculateSmartTextWordLayout(
      sampleLines,
      { x: 100, y: 200, width: 180, height: 48 },
      { x: 100, y: 200, width: 90, height: 24 }
    );

    expect(words).toHaveLength(2);
    expect(words[0].x).toBe(0);
    expect(words[0].width).toBe(50); // 25 * 2
    expect(words[0].height).toBe(48); // 24 * 2
    expect(words[1].x).toBe(60); // 30 * 2
    expect(words[1].width).toBe(120); // 60 * 2
  });

  it('returns empty array when lines is empty or undefined', () => {
    expect(
      calculateSmartTextWordLayout(
        [],
        { x: 0, y: 0, width: 100, height: 50 },
        {}
      )
    ).toEqual([]);

    expect(
      calculateSmartTextWordLayout(
        undefined,
        { x: 0, y: 0, width: 100, height: 50 },
        {}
      )
    ).toEqual([]);
  });

  it('preserves line layout for backwards compatibility', () => {
    const lines = calculateSmartTextLayout(
      sampleLines,
      { x: 100, y: 200, width: 90, height: 24 },
      { x: 100, y: 200, width: 90, height: 24 }
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('R$ 4.820,00');
  });
});
