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
