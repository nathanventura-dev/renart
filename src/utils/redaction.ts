import { RedactionAnnotation, RedactionEffect, RedactionLevel } from '../state/editorStore';

export type { RedactionLevel };

export const REDACTION_BLUR_RADII: Record<1 | 2, number> = {
  1: 8,
  2: 16,
};

export const REDACTION_SCRAMBLE_CONFIG: Record<1 | 2, { blockSize: number; noiseIntensity: number }> = {
  1: { blockSize: 3, noiseIntensity: 6 },
  2: { blockSize: 5, noiseIntensity: 10 },
};

/**
 * Resolve o nível de privacidade (1..3) garantindo compatibilidade com anotações antigas.
 * Nível 1: Rosto / desfoque suave (8px + blindagem) - PADRÃO
 * Nível 2: Texto atenuado / moderado (16px + blindagem)
 * Nível 3: Tarja preta sólida (#000000, absorve o antigo nível 4)
 */
export function resolveRedactionLevel(
  ann?: Partial<RedactionAnnotation> | { level?: RedactionLevel | number; effect?: RedactionEffect }
): RedactionLevel {
  if (ann?.level === 1 || ann?.level === 2) {
    return ann.level;
  }
  if (ann?.level === 3) {
    if (ann.effect === 'blur') {
      return 2;
    }
    return 3;
  }
  if (ann?.level === 4 || ann?.effect === 'blackout') {
    return 3;
  }
  if (ann?.effect === 'blur') {
    return 2;
  }
  return 1;
}

/**
 * Cria uma anotação de censura no modo Retângulo com dimensões e nível especificados.
 * Padrão: Nível 1 (Rosto).
 */
export function createRedactionRect(
  x: number,
  y: number,
  width: number,
  height: number,
  levelOrEffect: RedactionLevel | RedactionEffect | number = 1,
  id: string = `redact-${Date.now()}`
): RedactionAnnotation {
  const level: RedactionLevel =
    typeof levelOrEffect === 'number'
      ? (levelOrEffect === 4 || levelOrEffect === 3 ? 3 : levelOrEffect === 2 ? 2 : 1)
      : levelOrEffect === 'blackout'
        ? 3
        : 1;
  const effect: RedactionEffect = level === 3 ? 'blackout' : 'blur';

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
 * Padrão: Nível 1 (Rosto).
 */
export function createRedactionBrush(
  points: number[],
  levelOrEffect: RedactionLevel | RedactionEffect | number = 1,
  brushSize: number = 24,
  id: string = `redact-${Date.now()}`
): RedactionAnnotation {
  const level: RedactionLevel =
    typeof levelOrEffect === 'number'
      ? (levelOrEffect === 4 || levelOrEffect === 3 ? 3 : levelOrEffect === 2 ? 2 : 1)
      : levelOrEffect === 'blackout'
        ? 3
        : 1;
  const effect: RedactionEffect = level === 3 ? 'blackout' : 'blur';

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
