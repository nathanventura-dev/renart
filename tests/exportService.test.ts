// tests/exportService.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculatePdfPageDimensions,
  getMimeTypeForFormat,
  formatExportFilename,
} from '../src/services/exportService';

describe('Export Service', () => {
  it('computes landscape PDF dimensions when width is greater than height', () => {
    const dims = calculatePdfPageDimensions(1920, 1080);
    expect(dims.orientation).toBe('landscape');
    expect(dims.width).toBeGreaterThan(dims.height);
    expect(dims.width / dims.height).toBeCloseTo(1920 / 1080, 2);
  });

  it('computes portrait PDF dimensions when height is greater than width', () => {
    const dims = calculatePdfPageDimensions(1080, 1920);
    expect(dims.orientation).toBe('portrait');
    expect(dims.height).toBeGreaterThan(dims.width);
    expect(dims.height / dims.width).toBeCloseTo(1920 / 1080, 2);
  });

  it('resolves correct MIME types for formats', () => {
    expect(getMimeTypeForFormat('png')).toBe('image/png');
    expect(getMimeTypeForFormat('jpeg')).toBe('image/jpeg');
    expect(getMimeTypeForFormat('jpg')).toBe('image/jpeg');
  });

  it('generates consistent timestamps in filenames', () => {
    const name = formatExportFilename('Captura', 'png', 1700000000000);
    expect(name).toMatch(/^Captura-.*\.png$/);
  });
});
