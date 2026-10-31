import { describe, it, expect } from 'vitest';
import {
  sampleRegionColors,
  rgbToHex,
  calculateLuminance,
} from '../src/utils/colorSampling';

describe('Inpainting Color Sampler', () => {
  it('converts RGB components to hex correctly', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 59, 48)).toBe('#ff3b30');
    expect(rgbToHex(0, 113, 227)).toBe('#0071e3');
  });

  it('calculates relative luminance according to standard weights', () => {
    expect(calculateLuminance(255, 255, 255)).toBeCloseTo(255, 0);
    expect(calculateLuminance(0, 0, 0)).toBeCloseTo(0, 0);
    // Green has highest weight (0.7152)
    expect(calculateLuminance(0, 255, 0)).toBeGreaterThan(calculateLuminance(255, 0, 0));
  });

  it('samples dominant light background and returns dark contrasting text color', () => {
    // 100x100 white image data
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    // Fill all with white (255, 255, 255, 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }

    const { bgColor, textColor } = sampleRegionColors({ data, width, height }, {
      x: 10,
      y: 10,
      width: 50,
      height: 30,
    });

    expect(bgColor).toBe('#ffffff');
    expect(textColor).toBe('#1e293b');
  });

  it('samples dominant dark background and returns light contrasting text color', () => {
    // 100x100 dark navy image data (#0f172a = 15, 23, 42)
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 15;
      data[i + 1] = 23;
      data[i + 2] = 42;
      data[i + 3] = 255;
    }

    const { bgColor, textColor } = sampleRegionColors({ data, width, height }, {
      x: 5,
      y: 5,
      width: 80,
      height: 40,
    });

    expect(bgColor).toBe('#0f172a');
    expect(textColor).toBe('#f8fafc');
  });

  it('handles zero or out of bounds crops gracefully with safe fallback', () => {
    const width = 50;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);

    const safeResult = sampleRegionColors({ data, width, height }, {
      x: -50,
      y: -50,
      width: 0,
      height: 0,
    });

    expect(safeResult.bgColor).toBeDefined();
    expect(safeResult.textColor).toBeDefined();
  });
});
