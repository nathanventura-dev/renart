import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ZOOM_MODE,
  nextZoomMode,
  shouldApplyFit,
  resolveManualZoomOnLoad,
  decideZoomOnFit,
  describeZoomIndicator,
} from '../src/utils/zoomMode';

describe('zoomMode: transições de modo', () => {
  it('usa automático como padrão', () => {
    expect(DEFAULT_ZOOM_MODE).toBe('auto');
  });

  it('zoom do usuário leva para manual', () => {
    expect(nextZoomMode('auto', 'user-zoom')).toBe('manual');
    expect(nextZoomMode('manual', 'user-zoom')).toBe('manual');
  });

  it('reset leva para automático', () => {
    expect(nextZoomMode('manual', 'reset-to-auto')).toBe('auto');
    expect(nextZoomMode('auto', 'reset-to-auto')).toBe('auto');
  });

  it('carregar imagem mantém o modo atual', () => {
    expect(nextZoomMode('manual', 'image-load')).toBe('manual');
    expect(nextZoomMode('auto', 'image-load')).toBe('auto');
  });
});

describe('zoomMode: shouldApplyFit', () => {
  it('automático reage a load e resize', () => {
    expect(shouldApplyFit({ mode: 'auto', reason: 'load', width: 1000, height: 700 })).toBe(true);
    expect(shouldApplyFit({ mode: 'auto', reason: 'resize', width: 1000, height: 700 })).toBe(true);
  });

  it('manual reage só a load', () => {
    expect(shouldApplyFit({ mode: 'manual', reason: 'load', width: 1000, height: 700 })).toBe(true);
    expect(shouldApplyFit({ mode: 'manual', reason: 'resize', width: 1000, height: 700 })).toBe(false);
  });

  it('container com tamanho zero ou negativo nunca reajusta (janela escondida)', () => {
    for (const mode of ['auto', 'manual'] as const) {
      for (const reason of ['load', 'resize'] as const) {
        expect(shouldApplyFit({ mode, reason, width: 0, height: 700 })).toBe(false);
        expect(shouldApplyFit({ mode, reason, width: 1000, height: 0 })).toBe(false);
        expect(shouldApplyFit({ mode, reason, width: -5, height: 700 })).toBe(false);
      }
    }
  });
});

describe('zoomMode: resolveManualZoomOnLoad', () => {
  it('restaura o zoom salvo válido', () => {
    expect(resolveManualZoomOnLoad(1.5, 0.4)).toBe(1.5);
  });

  it('sem zoom salvo usa o ajuste', () => {
    expect(resolveManualZoomOnLoad(undefined, 0.4)).toBe(0.4);
  });

  it('zoom salvo inválido cai no ajuste', () => {
    expect(resolveManualZoomOnLoad(0, 0.4)).toBe(0.4);
    expect(resolveManualZoomOnLoad(NaN, 0.4)).toBe(0.4);
    expect(resolveManualZoomOnLoad(-1, 0.4)).toBe(0.4);
  });
});

describe('zoomMode: decideZoomOnFit', () => {
  const base = { width: 1200, height: 800, fitScale: 0.5 };

  it('automático aplica o ajuste em resize e load', () => {
    expect(decideZoomOnFit({ ...base, mode: 'auto', reason: 'resize' })).toEqual({ zoom: 0.5, saveZoom: false });
    expect(decideZoomOnFit({ ...base, mode: 'auto', reason: 'load' })).toEqual({ zoom: 0.5, saveZoom: false });
  });

  it('manual em resize não altera o zoom', () => {
    expect(decideZoomOnFit({ ...base, mode: 'manual', reason: 'resize' })).toEqual({ zoom: null, saveZoom: false });
  });

  it('manual em load restaura o zoom salvo sem regravar', () => {
    expect(decideZoomOnFit({ ...base, mode: 'manual', reason: 'load', savedZoom: 1.5 })).toEqual({
      zoom: 1.5,
      saveZoom: false,
    });
  });

  it('manual em load sem zoom salvo ajusta uma vez e manda salvar', () => {
    expect(decideZoomOnFit({ ...base, mode: 'manual', reason: 'load' })).toEqual({ zoom: 0.5, saveZoom: true });
    expect(decideZoomOnFit({ ...base, mode: 'manual', reason: 'load', savedZoom: NaN })).toEqual({
      zoom: 0.5,
      saveZoom: true,
    });
  });

  it('viewport zerado nunca altera o zoom', () => {
    for (const mode of ['auto', 'manual'] as const) {
      expect(decideZoomOnFit({ mode, reason: 'resize', width: 0, height: 0, fitScale: 0.5 })).toEqual({
        zoom: null,
        saveZoom: false,
      });
    }
  });
});

describe('zoomMode: describeZoomIndicator', () => {
  it('automático mostra o ícone, não é clicável e explica o comportamento', () => {
    const d = describeZoomIndicator('auto', 0.52);
    expect(d.label).toBe('52%');
    expect(d.showFitIcon).toBe(true);
    expect(d.clickable).toBe(false);
    expect(d.tooltip).toBe(
      'Zoom automático: a imagem acompanha o tamanho da janela. Dê zoom para controlar manualmente.'
    );
    expect(d.ariaLabel).toContain('automático');
    expect(d.ariaLabel).toContain('52%');
  });

  it('manual esconde o ícone, é clicável e ensina como voltar', () => {
    const d = describeZoomIndicator('manual', 1.5);
    expect(d.label).toBe('150%');
    expect(d.showFitIcon).toBe(false);
    expect(d.clickable).toBe(true);
    expect(d.tooltip).toBe('Zoom manual: clique para voltar ao zoom automático (Ctrl/Cmd 0).');
    expect(d.ariaLabel).toContain('manual');
    expect(d.ariaLabel).toContain('150%');
  });

  it('nunca é clicável e mostra o ícone ao mesmo tempo', () => {
    for (const mode of ['auto', 'manual'] as const) {
      const d = describeZoomIndicator(mode, 1);
      expect(d.clickable && d.showFitIcon).toBe(false);
    }
  });
});
