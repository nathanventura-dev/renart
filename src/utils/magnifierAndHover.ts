import { ToolType } from '../state/editorStore';

export const ZOOM_STEPS = [1.0, 1.5, 2.0, 2.5, 3.0] as const;
export type ZoomStep = (typeof ZOOM_STEPS)[number];

export const MIN_ZOOM = 1.0;
export const MAX_ZOOM = 3.0;
export const ZOOM_INCREMENT = 0.5;

/**
 * Arredonda qualquer valor de zoom para o passo mais próximo de 0.5
 * dentro do intervalo estrito [1.0, 3.0].
 */
export function snapToZoomStep(value: number): number {
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  const stepped = Math.round(clamped / ZOOM_INCREMENT) * ZOOM_INCREMENT;
  return Number(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, stepped)).toFixed(1));
}

/**
 * Calcula o novo nível de zoom ao clicar, segurar e arrastar a coroa giratória:
 * - Arrastar para a esquerda (deltaX < 0) diminui o zoom em passos de 0.5 até 1.0.
 * - Arrastar para a direita (deltaX > 0) aumenta o zoom em passos de 0.5 até 3.0.
 */
export function calculateZoomFromCrownDrag(
  initialZoom: number,
  deltaX: number,
  pixelsPerStep: number = 30
): number {
  const safeThreshold = Math.max(1, pixelsPerStep);
  // Quantos degraus inteiros de pixelsPerStep foram percorridos na direção do arraste
  const stepsDelta =
    deltaX >= 0
      ? Math.floor(deltaX / safeThreshold)
      : -Math.floor(Math.abs(deltaX) / safeThreshold);

  const rawZoom = initialZoom + stepsDelta * ZOOM_INCREMENT;
  return snapToZoomStep(rawZoom);
}

/**
 * Calcula a transformação da imagem interna da lupa para que o conteúdo
 * exatamente abaixo do centro (lensX, lensY) seja ampliado pelo fator zoomLevel.
 */
export function calculateMagnifierImageTransform(
  lensX: number,
  lensY: number,
  zoomLevel: number
): {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
} {
  const zoom = snapToZoomStep(zoomLevel);
  return {
    x: -lensX * zoom,
    y: -lensY * zoom,
    scaleX: zoom,
    scaleY: zoom,
  };
}

/**
 * Calcula o ângulo cosmético de rotação (em graus) da coroa giratória
 * mapeando [1.0 .. 3.0] para [-60° .. +60°].
 */
export function calculateCrownRotationAngle(zoomLevel: number): number {
  const zoom = snapToZoomStep(zoomLevel);
  // Em 1.0 -> -60°, em 2.0 -> 0°, em 3.0 -> +60°
  return (zoom - 2.0) * 60;
}

export interface PointerBehavior {
  cursor: 'default' | 'crosshair' | 'move';
  clickAction: 'move-existing' | 'create-new' | 'deselect';
}

/**
 * Define o cursor e a ação do clique com base na ferramenta selecionada
 * e se o ponteiro está passando por dentro da área de um bloco já existente.
 */
export function resolveCanvasPointerBehavior(
  activeTool: ToolType,
  isHoveringExistingBlock: boolean,
  isLocked: boolean = false
): PointerBehavior {
  if (isLocked) {
    return {
      cursor: 'default',
      clickAction: 'deselect',
    };
  }

  if (isHoveringExistingBlock) {
    return {
      cursor: 'move',
      clickAction: 'move-existing',
    };
  }

  if (activeTool === 'select') {
    return {
      cursor: 'default',
      clickAction: 'deselect',
    };
  }

  return {
    cursor: 'crosshair',
    clickAction: 'create-new',
  };
}
