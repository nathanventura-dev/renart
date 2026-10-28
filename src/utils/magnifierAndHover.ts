import { Annotation, ToolType } from '../state/editorStore';

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

/**
 * Determina se a barra inferior de nível de zoom deve ser exibida.
 * A barra só deve aparecer enquanto o usuário está ativamente movimentando/arrastando
 * a coroa giratória para fazer zoom naquela lupa específica.
 */
export function shouldShowZoomBar(activeCrownDragId: string | null, magnifierId: string): boolean {
  return Boolean(activeCrownDragId && activeCrownDragId === magnifierId);
}

/**
 * Calcula o progresso normalizado [0.0 .. 1.0] da barra minimalista de zoom
 * na parte inferior da lupa para o intervalo [1.0 .. 3.0].
 */
export function calculateZoomBarProgress(zoomLevel: number): number {
  const zoom = snapToZoomStep(zoomLevel);
  return Number(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)).toFixed(2));
}

/**
 * Define se o Transformer de redimensionamento do Konva deve ser acoplado ao tipo de bloco.
 * Todos os blocos de anotação (incluindo a lupa 'magnifier') suportam redimensionamento.
 */
export function shouldAttachTransformer(annotationType: ToolType): boolean {
  return annotationType !== 'select';
}

/**
 * Garante que o raio e a posição da lupa respeitem os limites da imagem ao redimensionar ou mover.
 */
export function clampMagnifierToImageBounds(
  x: number,
  y: number,
  radius: number,
  imageWidth: number,
  imageHeight: number,
  minRadius: number = 25
): { x: number; y: number; radius: number } {
  const safeW = Math.max(minRadius * 2, imageWidth);
  const safeH = Math.max(minRadius * 2, imageHeight);
  const maxRadius = Math.max(minRadius, Math.floor(Math.min(safeW, safeH) / 2));

  const clampedRadius = Math.max(minRadius, Math.min(maxRadius, Math.round(radius)));
  const clampedX = Math.max(clampedRadius, Math.min(safeW - clampedRadius, Math.round(x)));
  const clampedY = Math.max(clampedRadius, Math.min(safeH - clampedRadius, Math.round(y)));

  return {
    x: clampedX,
    y: clampedY,
    radius: clampedRadius,
  };
}

/**
 * Ordena as anotações garantindo que todas as lupas ('magnifier') fiquem sempre
 * no topo (acima de todos os demais blocos da imagem).
 */
export function sortAnnotationsWithMagnifiersOnTop<T extends { type: ToolType }>(
  annotations: T[]
): T[] {
  const nonMagnifiers = annotations.filter((a) => a.type !== 'magnifier');
  const magnifiers = annotations.filter((a) => a.type === 'magnifier');
  return [...nonMagnifiers, ...magnifiers];
}

/**
 * Retorna todos os blocos (formas, linhas, setas, textos, imagens) que devem ser
 * visualizados e ampliados dentro da lente da lupa.
 */
export function getMagnifierVisibleAnnotations<T extends { type: ToolType }>(
  annotations: T[]
): T[] {
  return annotations.filter((a) => a.type !== 'magnifier');
}

export interface PointerBehavior {
  cursor: 'default' | 'crosshair' | 'move';
  clickAction: 'move-existing' | 'create-new' | 'deselect';
}

/**
 * Identifica se o nó alvo do evento do Konva é um bloco de anotação real existente,
 * garantindo que a imagem de fundo ('bg-image'), o próprio Stage vazio ou a coroa da lupa
 * nunca sejam confundidos com um bloco ao alternar entre ferramentas.
 */
export function isTargetExistingAnnotation(targetName: string, isStageTarget: boolean): boolean {
  if (isStageTarget) return false;
  if (
    targetName === 'bg-image' ||
    targetName === 'magnifier-crown' ||
    targetName === 'marquee-selection-box'
  ) {
    return false;
  }
  return true;
}

export interface SelectionBoxBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcula a caixa delimitadora (bounding box) aproximada de uma anotação
 * e verifica quais blocos se intersectam com a caixa de multiseleção (clique e arraste).
 */
export function getAnnotationsInSelectionBox(
  annotations: Annotation[],
  box: SelectionBoxBounds
): string[] {
  const boxLeft = Math.min(box.x, box.x + box.width);
  const boxRight = Math.max(box.x, box.x + box.width);
  const boxTop = Math.min(box.y, box.y + box.height);
  const boxBottom = Math.max(box.y, box.y + box.height);

  const selectedIds: string[] = [];

  for (const ann of annotations) {
    const sx = ann.scaleX ?? 1;
    const sy = ann.scaleY ?? 1;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;

    if (ann.type === 'rect' || ann.type === 'image') {
      const x1 = ann.x;
      const y1 = ann.y;
      const x2 = ann.x + ann.width * sx;
      const y2 = ann.y + ann.height * sy;
      minX = Math.min(x1, x2);
      maxX = Math.max(x1, x2);
      minY = Math.min(y1, y2);
      maxY = Math.max(y1, y2);
    } else if (ann.type === 'ellipse') {
      const rx = Math.abs(ann.radiusX * sx);
      const ry = Math.abs(ann.radiusY * sy);
      minX = ann.x - rx;
      maxX = ann.x + rx;
      minY = ann.y - ry;
      maxY = ann.y + ry;
    } else if (ann.type === 'line' || ann.type === 'arrow') {
      const offsetX = ann.x || 0;
      const offsetY = ann.y || 0;
      const [p1x, p1y, p2x, p2y] = ann.points;
      const x1 = offsetX + p1x * sx;
      const y1 = offsetY + p1y * sy;
      const x2 = offsetX + p2x * sx;
      const y2 = offsetY + p2y * sy;
      minX = Math.min(x1, x2);
      maxX = Math.max(x1, x2);
      minY = Math.min(y1, y2);
      maxY = Math.max(y1, y2);
    } else if (ann.type === 'text') {
      const approxWidth = Math.max(40, ann.text.length * (ann.fontSize * 0.55) * Math.abs(sx));
      const approxHeight = ann.fontSize * 1.3 * Math.abs(sy);
      minX = ann.x;
      maxX = ann.x + approxWidth;
      minY = ann.y;
      maxY = ann.y + approxHeight;
    } else if (ann.type === 'magnifier') {
      minX = ann.x - ann.radius;
      maxX = ann.x + ann.radius;
      minY = ann.y - ann.radius;
      maxY = ann.y + ann.radius;
    }

    const intersects =
      maxX >= boxLeft && minX <= boxRight && maxY >= boxTop && minY <= boxBottom;
    if (intersects) {
      selectedIds.push(ann.id);
    }
  }

  return selectedIds;
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
