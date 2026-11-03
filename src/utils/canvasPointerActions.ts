/**
 * Determina se um clique no vazio do canvas deve apenas desselecionar/fechar edições existentes
 * em vez de criar um novo elemento.
 *
 * @param hasSelection Se há pelo menos um elemento selecionado no momento
 * @param isEditingText Se o editor inline de texto está aberto
 * @param isAltPressed Se a tecla Alt está sendo pressionada pelo usuário
 */
export function shouldDeselectOnEmptyClick(
  hasSelection: boolean,
  isEditingText: boolean,
  isAltPressed: boolean
): boolean {
  if (isAltPressed) return false;
  return hasSelection || isEditingText;
}

export type StampedToolType = 'rect' | 'ellipse' | 'redaction' | 'line' | 'arrow';

export interface DefaultShapeDimensions {
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  points?: [number, number, number, number];
}

/**
 * Retorna as dimensões padrão pré-definidas para carimbar formas no Alt + Click simples.
 */
export function getDefaultShapeDimensions(tool: StampedToolType): DefaultShapeDimensions {
  switch (tool) {
    case 'rect':
      return { width: 120, height: 60 };
    case 'ellipse':
      return { radiusX: 35, radiusY: 25 };
    case 'redaction':
      return { width: 120, height: 40 };
    case 'line':
    case 'arrow':
      return { points: [0, 0, 100, 0] };
  }
}

/**
 * Determina se o deslocamento do ponteiro entre mousedown e mouseup foi apenas um clique simples (<= threshold).
 */
export function isSimpleClick(
  displacementX: number,
  displacementY: number,
  threshold = 4
): boolean {
  return Math.abs(displacementX) <= threshold && Math.abs(displacementY) <= threshold;
}

export interface StampedShapeGeometry {
  x: number;
  y: number;
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  points?: number[];
}

/**
 * Calcula a geometria (posição e dimensões) para carimbar uma forma centralizada na posição do clique,
 * clampada aos limites da imagem.
 */
export function calculateStampedShapeGeometry(
  tool: StampedToolType,
  startPos: { x: number; y: number },
  imgW: number,
  imgH: number
): StampedShapeGeometry {
  switch (tool) {
    case 'rect': {
      const { width = 120, height = 60 } = getDefaultShapeDimensions('rect');
      const rawX = startPos.x - width / 2;
      const rawY = startPos.y - height / 2;
      const x = Math.max(0, Math.min(rawX, imgW - width));
      const y = Math.max(0, Math.min(rawY, imgH - height));
      return { x, y, width, height };
    }
    case 'ellipse': {
      const { radiusX = 35, radiusY = 25 } = getDefaultShapeDimensions('ellipse');
      const x = Math.max(radiusX, Math.min(startPos.x, imgW - radiusX));
      const y = Math.max(radiusY, Math.min(startPos.y, imgH - radiusY));
      return { x, y, radiusX, radiusY };
    }
    case 'redaction': {
      const { width = 120, height = 40 } = getDefaultShapeDimensions('redaction');
      const rawX = startPos.x - width / 2;
      const rawY = startPos.y - height / 2;
      const x = Math.max(0, Math.min(rawX, imgW - width));
      const y = Math.max(0, Math.min(rawY, imgH - height));
      return { x, y, width, height };
    }
    case 'line':
    case 'arrow': {
      const x1 = Math.max(0, Math.min(startPos.x, imgW));
      const y1 = Math.max(0, Math.min(startPos.y, imgH));
      const x2 = Math.max(0, Math.min(x1 + 100, imgW));
      const y2 = y1;
      return { x: 0, y: 0, points: [x1, y1, x2, y2] };
    }
  }
}
