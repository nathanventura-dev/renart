import { describe, it, expect, vi } from 'vitest';
import {
  detectTextInImageRegion,
  generateDevFallbackOcrLines,
} from '../src/services/ocrService';

describe('OCR Client Service', () => {
  it('returns empty array when region has zero or negative dimension', async () => {
    const lines = await detectTextInImageRegion('data:image/png;base64,abc', {
      x: 0,
      y: 0,
      width: 0,
      height: 10,
    });
    expect(lines).toEqual([]);
  });

  it('calls Tauri invoker when provided and returns parsed OCR lines', async () => {
    const mockInvoker = vi.fn().mockResolvedValue([
      {
        text: 'Documento Confidencial',
        x: 10,
        y: 10,
        width: 150,
        height: 20,
        words: [
          { text: 'Documento', x: 10, y: 10, width: 70, height: 20 },
          { text: 'Confidencial', x: 85, y: 10, width: 75, height: 20 },
        ],
      },
    ]);

    const lines = await detectTextInImageRegion(
      'data:image/png;base64,abc',
      { x: 10, y: 10, width: 150, height: 20 },
      mockInvoker
    );

    expect(mockInvoker).toHaveBeenCalledWith('detect_text_in_region', {
      imageBase64: 'data:image/png;base64,abc',
      x: 10,
      y: 10,
      width: 150,
      height: 20,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Documento Confidencial');
  });

  it('generates dev fallback lines fitted to box height and width when Tauri is unavailable', async () => {
    // Calling without invoker in pure node/vitest environment triggers dev fallback
    const lines = await detectTextInImageRegion('data:image/png;base64,abc', {
      x: 50,
      y: 100,
      width: 200,
      height: 60,
    });

    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0].words.length).toBeGreaterThanOrEqual(1);
    expect(lines[0].width).toBeLessThanOrEqual(200);
  });

  it('provides standalone fallback line generator', () => {
    const lines = generateDevFallbackOcrLines({
      x: 20,
      y: 30,
      width: 300,
      height: 80,
    });

    expect(lines.length).toBeGreaterThanOrEqual(2);
    lines.forEach((l) => {
      expect(l.x).toBeGreaterThanOrEqual(20);
      expect(l.words.length).toBeGreaterThan(0);
    });
  });
});
