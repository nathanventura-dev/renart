import { describe, it, expect, vi } from 'vitest';
import {
  scramblePixelData,
  createAntiAiBlurredCanvas,
} from '../src/utils/scrambleBlur';

describe('Anti-AI Pixel Scramble & Entropy Blur', () => {
  describe('scramblePixelData', () => {
    it('preserves buffer length and alpha channel for all pixels', () => {
      const width = 10;
      const height = 10;
      const original = new Uint8ClampedArray(width * height * 4);

      for (let i = 0; i < original.length; i += 4) {
        original[i] = (i * 3) % 256;       // R
        original[i + 1] = (i * 7) % 256;   // G
        original[i + 2] = (i * 11) % 256;  // B
        original[i + 3] = 255;             // Alpha 100%
      }

      const scrambled = scramblePixelData(new Uint8ClampedArray(original), width, height, 3, 0);

      expect(scrambled.length).toBe(original.length);

      // Verify all alpha channels are strictly preserved
      for (let i = 0; i < scrambled.length; i += 4) {
        expect(scrambled[i + 3]).toBe(255);
      }
    });

    it('alters high-frequency pixel positions within blocks (entropy increase)', () => {
      const width = 6;
      const height = 6;
      const original = new Uint8ClampedArray(width * height * 4);

      // Create a sharp black/white high-frequency grid
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const val = (x + y) % 2 === 0 ? 0 : 255;
          original[idx] = val;
          original[idx + 1] = val;
          original[idx + 2] = val;
          original[idx + 3] = 255;
        }
      }

      const scrambled = scramblePixelData(new Uint8ClampedArray(original), width, height, 3, 0);

      // Scrambled array should not be identical to original due to permutation
      let diffCount = 0;
      for (let i = 0; i < original.length; i += 4) {
        if (scrambled[i] !== original[i]) {
          diffCount++;
        }
      }

      expect(diffCount).toBeGreaterThan(0);
    });

    it('conserves mean color within each block when noise is zero', () => {
      const width = 4;
      const height = 4;
      const blockSize = 2;
      const original = new Uint8ClampedArray(width * height * 4);

      for (let i = 0; i < original.length; i += 4) {
        original[i] = i % 250;
        original[i + 1] = (i * 2) % 250;
        original[i + 2] = (i * 3) % 250;
        original[i + 3] = 255;
      }

      const scrambled = scramblePixelData(new Uint8ClampedArray(original), width, height, blockSize, 0);

      // Total sum of RGB in each 2x2 block must be equal
      for (let by = 0; by < height; by += blockSize) {
        for (let bx = 0; bx < width; bx += blockSize) {
          let origR = 0, origG = 0, origB = 0;
          let scramR = 0, scramG = 0, scramB = 0;

          for (let y = by; y < by + blockSize; y++) {
            for (let x = bx; x < bx + blockSize; x++) {
              const idx = (y * width + x) * 4;
              origR += original[idx];
              origG += original[idx + 1];
              origB += original[idx + 2];

              scramR += scrambled[idx];
              scramG += scrambled[idx + 1];
              scramB += scrambled[idx + 2];
            }
          }

          expect(scramR).toBe(origR);
          expect(scramG).toBe(origG);
          expect(scramB).toBe(origB);
        }
      }
    });

    it('applies subtle noise within specified bounds and clamps between 0-255', () => {
      const width = 8;
      const height = 8;
      const original = new Uint8ClampedArray(width * height * 4);

      // Flat grey
      for (let i = 0; i < original.length; i += 4) {
        original[i] = 128;
        original[i + 1] = 128;
        original[i + 2] = 128;
        original[i + 3] = 255;
      }

      const noiseIntensity = 8;
      const scrambled = scramblePixelData(new Uint8ClampedArray(original), width, height, 2, noiseIntensity);

      for (let i = 0; i < scrambled.length; i += 4) {
        expect(scrambled[i]).toBeGreaterThanOrEqual(128 - noiseIntensity);
        expect(scrambled[i]).toBeLessThanOrEqual(128 + noiseIntensity);
        expect(scrambled[i + 3]).toBe(255);
      }
    });

    it('handles edge cases gracefully (odd dimensions, 1x1, empty)', () => {
      // 1x1 image
      const single = new Uint8ClampedArray([100, 150, 200, 255]);
      const resSingle = scramblePixelData(new Uint8ClampedArray(single), 1, 1, 3, 5);
      expect(resSingle.length).toBe(4);
      expect(resSingle[3]).toBe(255);

      // Odd dimensions 7x5 with block 3
      const odd = new Uint8ClampedArray(7 * 5 * 4);
      odd.fill(200);
      const resOdd = scramblePixelData(new Uint8ClampedArray(odd), 7, 5, 3, 0);
      expect(resOdd.length).toBe(7 * 5 * 4);

      // Block size larger than image
      const resLargeBlock = scramblePixelData(new Uint8ClampedArray(odd), 7, 5, 20, 2);
      expect(resLargeBlock.length).toBe(7 * 5 * 4);

      // Invalid dimensions
      const empty = new Uint8ClampedArray(0);
      expect(scramblePixelData(empty, 0, 0, 3)).toEqual(empty);
    });
  });

  describe('createAntiAiBlurredCanvas', () => {
    it('returns null if document is undefined', () => {
      const fakeImage = { width: 50, height: 50 } as HTMLImageElement;
      const res = createAntiAiBlurredCanvas(fakeImage, 8, 3);
      expect(res).toBeNull();
    });

    it('creates offscreen canvas with correct dimensions and blur filter when document is available', () => {
      const mockCtx = {
        filter: '',
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(100 * 100 * 4).fill(200),
          width: 100,
          height: 100,
        })),
        putImageData: vi.fn(),
      };

      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        createElement: vi.fn((tagName: string) => {
          if (tagName === 'canvas') {
            return {
              width: 0,
              height: 0,
              getContext: vi.fn(() => mockCtx),
            };
          }
          return {};
        }),
      };

      const fakeImage = {
        width: 100,
        height: 100,
      } as HTMLImageElement;

      const resultCanvas = createAntiAiBlurredCanvas(fakeImage, 8, 3, 6);

      expect(resultCanvas).not.toBeNull();
      expect(mockCtx.drawImage).toHaveBeenCalled();
      expect(mockCtx.getImageData).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(mockCtx.putImageData).toHaveBeenCalled();
      expect(mockCtx.filter).toBe('blur(8px)');

      (globalThis as any).document = originalDocument;
    });

    it('returns null gracefully if context cannot be created', () => {
      const originalDocument = (globalThis as any).document;
      (globalThis as any).document = {
        createElement: vi.fn(() => ({
          width: 0,
          height: 0,
          getContext: vi.fn(() => null),
        })),
      };

      const fakeImage = { width: 50, height: 50 } as HTMLImageElement;
      const res = createAntiAiBlurredCanvas(fakeImage, 8, 3);
      expect(res).toBeNull();

      (globalThis as any).document = originalDocument;
    });
  });
});
