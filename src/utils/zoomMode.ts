import { formatZoomPercentage } from './zoomAndCrop';

export type ZoomMode = 'auto' | 'manual';
export const DEFAULT_ZOOM_MODE: ZoomMode = 'auto';

export type ZoomModeAction = 'user-zoom' | 'reset-to-auto' | 'image-load';
export type FitReason = 'load' | 'resize';

/**
 * Transição de modo: zoom feito pelo usuário fixa o modo manual; o reset volta ao automático;
 * carregar uma imagem mantém o modo atual.
 */
export function nextZoomMode(mode: ZoomMode, action: ZoomModeAction): ZoomMode {
  if (action === 'user-zoom') return 'manual';
  if (action === 'reset-to-auto') return 'auto';
  return mode;
}

/**
 * Decide se um recálculo de ajuste deve ser considerado.
 * Container com tamanho zero (janela escondida na bandeja) nunca reajusta.
 * O automático reage a `load` e `resize`; o manual só a `load` (para restaurar o zoom salvo).
 */
export function shouldApplyFit(input: {
  mode: ZoomMode;
  reason: FitReason;
  width: number;
  height: number;
}): boolean {
  if (!(input.width > 0) || !(input.height > 0)) return false;
  return input.mode === 'auto' || input.reason === 'load';
}

function isValidZoom(zoom: number | undefined): zoom is number {
  return typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0;
}

/** Zoom salvo da imagem, ou o ajuste quando não existe (ou está inválido). */
export function resolveManualZoomOnLoad(saved: number | undefined, fitScale: number): number {
  return isValidZoom(saved) ? saved : fitScale;
}

/**
 * Concentra a decisão do zoom ao receber um novo ajuste.
 * `zoom: null` significa "não alterar"; `saveZoom` pede para gravar o zoom da captura ativa.
 */
export function decideZoomOnFit(input: {
  mode: ZoomMode;
  reason: FitReason;
  width: number;
  height: number;
  fitScale: number;
  savedZoom?: number;
}): { zoom: number | null; saveZoom: boolean } {
  if (!shouldApplyFit(input)) return { zoom: null, saveZoom: false };
  if (input.mode === 'auto') return { zoom: input.fitScale, saveZoom: false };
  return {
    zoom: resolveManualZoomOnLoad(input.savedZoom, input.fitScale),
    saveZoom: !isValidZoom(input.savedZoom),
  };
}

const AUTO_TOOLTIP =
  'Zoom automático: a imagem acompanha o tamanho da janela. Dê zoom para controlar manualmente.';
const MANUAL_TOOLTIP = 'Zoom manual: clique para voltar ao zoom automático (Ctrl/Cmd 0).';

/** O que o indicador de zoom da barra deve mostrar em cada modo. */
export function describeZoomIndicator(
  mode: ZoomMode,
  zoomLevel: number
): { label: string; showFitIcon: boolean; clickable: boolean; tooltip: string; ariaLabel: string } {
  const label = formatZoomPercentage(zoomLevel);
  if (mode === 'auto') {
    return {
      label,
      showFitIcon: true,
      clickable: false,
      tooltip: AUTO_TOOLTIP,
      ariaLabel: `Zoom automático ${label}`,
    };
  }
  return {
    label,
    showFitIcon: false,
    clickable: true,
    tooltip: MANUAL_TOOLTIP,
    ariaLabel: `Zoom manual ${label}. Voltar ao zoom automático`,
  };
}
