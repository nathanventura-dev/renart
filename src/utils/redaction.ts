import { RedactionAnnotation, RedactionEffect, RedactionLevel } from '../state/editorStore';

export type { RedactionLevel };

export const REDACTION_BLUR_RADII: Record<1 | 2 | 3, number> = {
  1: 8,
  2: 14,
  3: 26,
};

/**
 * Resolve o nível de privacidade (1..4) garantindo compatibilidade com anotações antigas.
 * Nível 1: Rosto / desfoque suave (8px)
 * Nível 2: Texto atenuado / moderado (14px)
 * Nível 3: Sem visibilidade / desfoque cego total (26px)
 * Nível 4: Tarja preta sólida (#000000)
 */
export function resolveRedactionLevel(
  ann?: Partial<RedactionAnnotation> | { level?: RedactionLevel; effect?: RedactionEffect }
): RedactionLevel {
  if (ann?.level === 1 || ann?.level === 2 || ann?.level === 3 || ann?.level === 4) {
    return ann.level;
  }
  if (ann?.effect === 'blur') {
    return 3;
  }
  return 4;
}

/**
 * Cria uma anotação de censura no modo Retângulo com dimensões e nível especificados.
 */
export function createRedactionRect(
  x: number,
  y: number,
  width: number,
  height: number,
  levelOrEffect: RedactionLevel | RedactionEffect = 4,
  id: string = `redact-${Date.now()}`
): RedactionAnnotation {
  const level: RedactionLevel =
    typeof levelOrEffect === 'number' ? levelOrEffect : levelOrEffect === 'blur' ? 3 : 4;
  const effect: RedactionEffect = level === 4 ? 'blackout' : 'blur';

  return {
    id,
    type: 'redaction',
    level,
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
  levelOrEffect: RedactionLevel | RedactionEffect = 4,
  brushSize: number = 24,
  id: string = `redact-${Date.now()}`
): RedactionAnnotation {
  const level: RedactionLevel =
    typeof levelOrEffect === 'number' ? levelOrEffect : levelOrEffect === 'blur' ? 3 : 4;
  const effect: RedactionEffect = level === 4 ? 'blackout' : 'blur';

  return {
    id,
    type: 'redaction',
    level,
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
