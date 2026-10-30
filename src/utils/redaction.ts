import { RedactionAnnotation, RedactionEffect } from '../state/editorStore';

/**
 * Cria uma anotação de censura no modo Retângulo com dimensões e efeito especificados.
 */
export function createRedactionRect(
  x: number,
  y: number,
  width: number,
  height: number,
  effect: RedactionEffect = 'blackout',
  id: string = `redact-${Date.now()}`
): RedactionAnnotation {
  return {
    id,
    type: 'redaction',
    effect,
    mode: 'rect',
    x,
    y,
    width,
    height,
  };
}

/**
 * Cria uma anotação de censura no modo Pincel com lista de coordenadas e espessura do traço.
 */
export function createRedactionBrush(
  points: number[],
  effect: RedactionEffect = 'blackout',
  brushSize: number = 24,
  id: string = `redact-${Date.now()}`
): RedactionAnnotation {
  return {
    id,
    type: 'redaction',
    effect,
    mode: 'brush',
    points,
    brushSize,
  };
}

/**
 * Ajusta e limita uma caixa de redaction retangular aos limites da imagem.
 */
export function clampRedactionRectToBounds(
  rawX: number,
  rawY: number,
  width: number,
  height: number,
  imgW: number,
  imgH: number
): { x: number; y: number; width: number; height: number } {
  // Ajusta se largura ou altura forem negativas (desenhadas para a esquerda ou para cima)
  let actualX = width < 0 ? rawX + width : rawX;
  let actualY = height < 0 ? rawY + height : rawY;
  let actualW = Math.abs(width);
  let actualH = Math.abs(height);

  if (actualX < 0) {
    actualW = Math.max(0, actualW + actualX);
    actualX = 0;
  }
  if (actualY < 0) {
    actualH = Math.max(0, actualH + actualY);
    actualY = 0;
  }

  actualW = Math.min(actualW, Math.max(0, imgW - actualX));
  actualH = Math.min(actualH, Math.max(0, imgH - actualY));

  return {
    x: Math.round(actualX),
    y: Math.round(actualY),
    width: Math.round(actualW),
    height: Math.round(actualH),
  };
}
