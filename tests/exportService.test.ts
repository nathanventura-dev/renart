// tests/exportService.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculatePdfPageDimensions,
  getMimeTypeForFormat,
  formatExportFilename,
  calculateNativeExportPixelRatio,
  copyCanvasToClipboard,
  exportCanvas,
  toNativeDataUrl,
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

  it('calculates 1:1 native export pixelRatio inversely proportional to stage zoom scale', () => {
    // 100% zoom (1.0) => pixelRatio 1.0 (mantém resolução nativa 1:1)
    expect(calculateNativeExportPixelRatio(1.0)).toBe(1.0);

    // 50% zoom (0.5) => pixelRatio 2.0 (compensa a redução de 0.5 do stage: 0.5 * 2.0 = 1.0)
    expect(calculateNativeExportPixelRatio(0.5)).toBe(2.0);

    // 25% zoom (0.25) => pixelRatio 4.0 (0.25 * 4.0 = 1.0)
    expect(calculateNativeExportPixelRatio(0.25)).toBe(4.0);

    // 200% zoom (2.0) => pixelRatio 0.5 (2.0 * 0.5 = 1.0)
    expect(calculateNativeExportPixelRatio(2.0)).toBe(0.5);

    // Zoom inválido ou zero não quebra e retorna 1.0
    expect(calculateNativeExportPixelRatio(0)).toBe(1.0);
    expect(calculateNativeExportPixelRatio(-1)).toBe(1.0);
  });

  it('hides editor overlays during copyCanvasToClipboard and restores them immediately', async () => {
    let transformerVisible = true;
    let twoPointVisible = true;
    let callParams: Record<string, unknown> = {};

    const mockTransformer = {
      visible: (v?: boolean) => {
        if (v !== undefined) transformerVisible = v;
        return transformerVisible;
      },
    };
    const mockTwoPoint = {
      visible: (v?: boolean) => {
        if (v !== undefined) twoPointVisible = v;
        return twoPointVisible;
      },
    };

    const mockStage = {
      scaleX: () => 0.5,
      scaleY: () => 0.5,
      width: () => 400,
      height: () => 300,
      findOne: (selector: string) => {
        if (selector === 'Transformer') return mockTransformer;
        if (selector === '.two-point-anchors-group') return mockTwoPoint;
        return null;
      },
      batchDraw: () => {},
      toDataURL: (params: Record<string, unknown>) => {
        callParams = params;
        // Durante a geração da imagem, os overlays devem estar invisíveis!
        expect(transformerVisible).toBe(false);
        expect(twoPointVisible).toBe(false);
        return 'data:image/png;base64,mockImage';
      },
    };

    // Mock global navigator.clipboard e fetch
    const originalClipboard = (navigator as any).clipboard;
    const originalClipboardItem = (global as any).ClipboardItem;
    (global as any).ClipboardItem = class MockClipboardItem {
      data: any;
      constructor(data: any) {
        this.data = data;
      }
    };
    let writtenBlob: unknown = null;
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        write: async (items: Array<any>) => {
          writtenBlob = items[0];
        },
      },
      configurable: true,
      writable: true,
    });

    const originalFetch = global.fetch;
    global.fetch = async () =>
      ({
        blob: async () => new Blob(['mock'], { type: 'image/png' }),
      } as any);

    try {
      // 1. Chamada com zoomLevel = 0.5 explícito: pixelRatio deve ser 2.0
      await copyCanvasToClipboard(mockStage as any, 0.5);
      expect(callParams.pixelRatio).toBe(2.0);
      expect(writtenBlob).toBeDefined();

      // Após a exportação, os overlays voltam ao estado visível original
      expect(transformerVisible).toBe(true);
      expect(twoPointVisible).toBe(true);

      // 2. Chamada com zoomLevel = 1.0 (100%): pixelRatio deve ser 1.0
      await copyCanvasToClipboard(mockStage as any, 1.0);
      expect(callParams.pixelRatio).toBe(1.0);
      expect(transformerVisible).toBe(true);

      // 3. Teste com exportCanvas
      await exportCanvas(mockStage as any, 'png', 'test-shot', 1.0);
      expect(callParams.pixelRatio).toBe(1.0);
      expect(transformerVisible).toBe(true);
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
        writable: true,
      });
      (global as any).ClipboardItem = originalClipboardItem;
      global.fetch = originalFetch;
    }
  });

  it('guarantees that multi-selection outlines and transformer are hidden during export with redactions', async () => {
    let outlinesVisible = true;
    let transformerVisible = true;

    const mockStage = {
      scaleX: () => 1.0,
      scaleY: () => 1.0,
      width: () => 800,
      height: () => 600,
      findOne: (selector: string) => {
        if (selector === 'Transformer') {
          return {
            visible: (v?: boolean) => {
              if (v !== undefined) transformerVisible = v;
              return transformerVisible;
            },
          };
        }
        if (selector === '.multi-selection-outlines-group') {
          return {
            visible: (v?: boolean) => {
              if (v !== undefined) outlinesVisible = v;
              return outlinesVisible;
            },
          };
        }
        return null;
      },
      batchDraw: () => {},
      toDataURL: () => {
        // Assegura que ambos estejam ocultados durante a rasterização
        expect(transformerVisible).toBe(false);
        expect(outlinesVisible).toBe(false);
        return 'data:image/png;base64,mockFlatRasterImage';
      },
    };

    await exportCanvas(mockStage as any, 'png', 'secure-redaction', 1.0);
    // Restaurados após a exportação
    expect(transformerVisible).toBe(true);
    expect(outlinesVisible).toBe(true);
  });

  describe('toNativeDataUrl (exportação 1:1 independente do arredondamento do zoom)', () => {
    function makeStage(native: { w: number; h: number } | null, zoom: number, visualW: number, visualH: number) {
      const state = { sx: zoom, sy: zoom, w: visualW, h: visualH };
      const seen: Record<string, unknown> = {};
      const stage = {
        scaleX: () => state.sx,
        scaleY: () => state.sy,
        scale: (v?: { x: number; y: number }) => {
          if (v) { state.sx = v.x; state.sy = v.y; }
          return { x: state.sx, y: state.sy };
        },
        width: (v?: number) => { if (v !== undefined) state.w = v; return state.w; },
        height: (v?: number) => { if (v !== undefined) state.h = v; return state.h; },
        findOne: (sel: string) =>
          sel === '.bg-image' && native ? { width: () => native.w, height: () => native.h } : null,
        batchDraw: () => {},
        toDataURL: (params: Record<string, unknown>) => {
          seen.params = params;
          seen.stageW = state.w;
          seen.stageH = state.h;
          seen.stageScale = state.sx;
          return 'data:image/png;base64,x';
        },
      };
      return { stage, state, seen };
    }

    it('renders at the exact native size (ratio 1, scale 1) even when the rounded visual size would be off by 1px', () => {
      // 3456x2234 com zoom 0.3813: visual 1318x852; 1/zoom arredondado exportaria 3457x2234
      const { stage, seen } = makeStage({ w: 3456, h: 2234 }, 0.3813, 1318, 852);
      const out = toNativeDataUrl(stage as any, 0.3813);
      expect(seen.params).toMatchObject({ pixelRatio: 1 });
      expect(seen.stageW).toBe(3456);
      expect(seen.stageH).toBe(2234);
      expect(seen.stageScale).toBe(1);
      expect(out).toMatchObject({ width: 3456, height: 2234 });
    });

    it('restores the on-screen zoom and visual size after rendering', () => {
      const { stage, state } = makeStage({ w: 3456, h: 2234 }, 0.3813, 1318, 852);
      toNativeDataUrl(stage as any, 0.3813);
      expect(state).toEqual({ sx: 0.3813, sy: 0.3813, w: 1318, h: 852 });
    });

    it('falls back to the inverse-zoom pixelRatio when the stage has no background image', () => {
      const { stage, seen } = makeStage(null, 0.5, 400, 300);
      const out = toNativeDataUrl(stage as any, 0.5);
      expect(seen.params).toMatchObject({ pixelRatio: 2 });
      expect(out).toMatchObject({ width: 800, height: 600 });
    });

    it('forwards mimeType and quality', () => {
      const { stage, seen } = makeStage({ w: 100, h: 100 }, 1, 100, 100);
      toNativeDataUrl(stage as any, 1, { mimeType: 'image/jpeg', quality: 0.95 });
      expect(seen.params).toMatchObject({ mimeType: 'image/jpeg', quality: 0.95, pixelRatio: 1 });
    });
  });
});
