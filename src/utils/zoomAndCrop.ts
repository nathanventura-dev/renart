import type { Annotation, ArrowStyle, ToolType } from '../state/editorStore';

export const MIN_ZOOM_LEVEL = 0.25; // 25%
export const MAX_ZOOM_LEVEL = 4.0; // 400%
export const DEFAULT_ZOOM_LEVEL = 1.0; // 100%

export const ZOOM_PRESETS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0,
] as const;

/**
 * Calcula a escala inicial para que a imagem caiba inteira dentro da janela (viewport)
 * sem gerar nenhuma barra de rolagem horizontal ou vertical:
 * - Se a imagem for menor ou igual à área disponível: mantém 100% (1.0) centralizada.
 * - Se a imagem for maior que a área disponível: calcula a redução proporcional ideal.
 */
export function calculateFitToScreenScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 24
): number {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return DEFAULT_ZOOM_LEVEL;
  }

  const usableWidth = Math.max(10, viewportWidth - padding * 2);
  const usableHeight = Math.max(10, viewportHeight - padding * 2);

  // Se a imagem couber confortavelmente no tamanho 100%, mantém o tamanho nativo original
  if (imageWidth <= usableWidth && imageHeight <= usableHeight) {
    return DEFAULT_ZOOM_LEVEL;
  }

  const scaleX = usableWidth / imageWidth;
  const scaleY = usableHeight / imageHeight;
  const fitScale = Math.min(scaleX, scaleY);

  return clampZoomLevel(fitScale);
}

/**
 * Restringe o nível de zoom aos limites mínimo (0.25) e máximo (4.0).
 */
export function clampZoomLevel(
  zoom: number,
  minZoom: number = MIN_ZOOM_LEVEL,
  maxZoom: number = MAX_ZOOM_LEVEL
): number {
  return Number(Math.max(minZoom, Math.min(maxZoom, zoom)).toFixed(3));
}

/**
 * Retorna o próximo passo discreto de zoom para Zoom In (+) ou Zoom Out (-).
 */
export function getNextZoomStep(currentZoom: number, direction: 'in' | 'out'): number {
  const safeCurrent = clampZoomLevel(currentZoom);

  if (direction === 'in') {
    for (const step of ZOOM_PRESETS) {
      if (step > safeCurrent + 0.02) {
        return step;
      }
    }
    return MAX_ZOOM_LEVEL;
  }

  // direction === 'out'
  for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
    const step = ZOOM_PRESETS[i];
    if (step < safeCurrent - 0.02) {
      return step;
    }
  }
  return MIN_ZOOM_LEVEL;
}

/**
 * Formata o nível de zoom em porcentagem limpa para exibição na barra (ex: '100%', '75%', '150%').
 */
export function formatZoomPercentage(zoomLevel: number): string {
  return `${Math.round(zoomLevel * 100)}%`;
}

/**
 * Reconhece se um evento de teclado corresponde a um atalho de zoom:
 * - 'in': Ctrl/Cmd + '+' ou '='
 * - 'out': Ctrl/Cmd + '-' ou '_'
 * - 'reset': Ctrl/Cmd + '0'
 */
export function isZoomShortcut(e: {
  ctrlKey: boolean;
  metaKey: boolean;
  key: string;
}): 'in' | 'out' | 'reset' | null {
  if (!e.ctrlKey && !e.metaKey) {
    return null;
  }
  if (e.key === '+' || e.key === '=') {
    return 'in';
  }
  if (e.key === '-' || e.key === '_') {
    return 'out';
  }
  if (e.key === '0') {
    return 'reset';
  }
  return null;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normaliza e restringe a caixa de recorte aos limites da imagem de fundo com tamanho mínimo de 10px.
 */
export function calculateCropBounds(
  cropBox: CropBox,
  imageWidth: number,
  imageHeight: number,
  minDimension: number = 10
): CropBox {
  const normX1 = Math.min(cropBox.x, cropBox.x + cropBox.width);
  const normY1 = Math.min(cropBox.y, cropBox.y + cropBox.height);
  const rawW = Math.abs(cropBox.width);
  const rawH = Math.abs(cropBox.height);

  const clampedX = Math.max(0, Math.min(imageWidth - minDimension, Math.round(normX1)));
  const clampedY = Math.max(0, Math.min(imageHeight - minDimension, Math.round(normY1)));
  const clampedW = Math.max(
    minDimension,
    Math.min(imageWidth - clampedX, Math.round(rawW))
  );
  const clampedH = Math.max(
    minDimension,
    Math.min(imageHeight - clampedY, Math.round(rawH))
  );

  return {
    x: clampedX,
    y: clampedY,
    width: clampedW,
    height: clampedH,
  };
}

/**
 * Ajusta todas as anotações existentes após um recorte:
 * - Translada coordenadas dos blocos por -cropOffset.x e -cropOffset.y
 * - Descarta anotações que ficaram 100% fora da nova área recortada
 */
export function adjustAnnotationsForCrop(
  annotations: Annotation[],
  cropOffset: { x: number; y: number },
  cropSize: { width: number; height: number }
): Annotation[] {
  const cropRight = cropSize.width;
  const cropBottom = cropSize.height;

  const adjustedList: Annotation[] = [];

  for (const ann of annotations) {
    if (ann.type === 'rect' || ann.type === 'image') {
      const nextX = ann.x - cropOffset.x;
      const nextY = ann.y - cropOffset.y;
      const right = nextX + ann.width;
      const bottom = nextY + ann.height;

      // Se estiver 100% fora do retângulo de corte, descarta
      if (right <= 0 || nextX >= cropRight || bottom <= 0 || nextY >= cropBottom) {
        continue;
      }
      adjustedList.push({
        ...ann,
        x: nextX,
        y: nextY,
      });
      continue;
    }

    if (ann.type === 'ellipse') {
      const nextX = ann.x - cropOffset.x;
      const nextY = ann.y - cropOffset.y;
      const left = nextX - ann.radiusX;
      const right = nextX + ann.radiusX;
      const top = nextY - ann.radiusY;
      const bottom = nextY + ann.radiusY;

      if (right <= 0 || left >= cropRight || bottom <= 0 || top >= cropBottom) {
        continue;
      }
      adjustedList.push({
        ...ann,
        x: nextX,
        y: nextY,
      });
      continue;
    }

    if (ann.type === 'line' || ann.type === 'arrow') {
      const offsetX = ann.x ? ann.x - cropOffset.x : -cropOffset.x;
      const offsetY = ann.y ? ann.y - cropOffset.y : -cropOffset.y;
      const newPoints = ann.points.map((pt, idx) =>
        idx % 2 === 0 ? pt + offsetX : pt + offsetY
      );

      // Verifica se pelo menos 1 ponto intercepta ou está próximo da área de corte
      let hasVisiblePoint = false;
      for (let i = 0; i < newPoints.length; i += 2) {
        const px = newPoints[i];
        const py = newPoints[i + 1];
        if (px >= 0 && px <= cropRight && py >= 0 && py <= cropBottom) {
          hasVisiblePoint = true;
          break;
        }
      }
      if (!hasVisiblePoint) {
        continue;
      }

      adjustedList.push({
        ...ann,
        x: 0,
        y: 0,
        points: newPoints,
      });
      continue;
    }

    if (ann.type === 'text') {
      const nextX = ann.x - cropOffset.x;
      const nextY = ann.y - cropOffset.y;

      if (nextX + 150 < 0 || nextX > cropRight || nextY + 30 < 0 || nextY > cropBottom) {
        continue;
      }
      adjustedList.push({
        ...ann,
        x: nextX,
        y: nextY,
      });
      continue;
    }

    if (ann.type === 'magnifier') {
      const nextX = ann.x - cropOffset.x;
      const nextY = ann.y - cropOffset.y;
      const left = nextX - ann.radius;
      const right = nextX + ann.radius;
      const top = nextY - ann.radius;
      const bottom = nextY + ann.radius;

      if (right <= 0 || left >= cropRight || bottom <= 0 || top >= cropBottom) {
        continue;
      }

      const nextFocusX =
        ann.focusX !== undefined ? ann.focusX - cropOffset.x : undefined;
      const nextFocusY =
        ann.focusY !== undefined ? ann.focusY - cropOffset.y : undefined;

      adjustedList.push({
        ...ann,
        x: nextX,
        y: nextY,
        ...(nextFocusX !== undefined ? { focusX: nextFocusX } : {}),
        ...(nextFocusY !== undefined ? { focusY: nextFocusY } : {}),
      });
      continue;
    }
  }

  return adjustedList;
}

/**
 * Converte coordenadas absolutas de tela/ponteiro da janela do Stage para
 * coordenadas reais não-escaladas do canvas da imagem, com precisão em qualquer nível de zoom.
 */
export function getTransformedPointerPosition(
  rawPointer: { x: number; y: number },
  zoomLevel: number
): { x: number; y: number } {
  const safeZoom = zoomLevel > 0 ? zoomLevel : 1.0;
  return {
    x: rawPointer.x / safeZoom,
    y: rawPointer.y / safeZoom,
  };
}

/**
 * Converte a posição absoluta do nó fornecida pelo `dragBoundFunc` do Konva para o espaço
 * de pixels da imagem original, executa o clamping nos limites reais da imagem, e retorna
 * as coordenadas absolutas exigidas pelo Konva multiplicadas de volta pelo `zoomLevel`.
 *
 * Isso garante que o elemento (lupa, recorte, etc.) possa se movimentar por 100% da área útil
 * da imagem sem travar quando o zoom estiver acima ou abaixo de 100%.
 */
export function getTransformedDragBound(
  absolutePos: { x: number; y: number },
  zoomLevel: number,
  clampFn: (localX: number, localY: number) => { x: number; y: number }
): { x: number; y: number } {
  const safeZoom = zoomLevel > 0 ? zoomLevel : 1.0;
  const localX = absolutePos.x / safeZoom;
  const localY = absolutePos.y / safeZoom;
  const clampedLocal = clampFn(localX, localY);
  return {
    x: clampedLocal.x * safeZoom,
    y: clampedLocal.y * safeZoom,
  };
}

export interface TransformerBoundBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/**
 * Converte uma caixa delimitadora em coordenadas absolutas do Stage (como fornecida pelo `boundBoxFunc` do Transformer)
 * para coordenadas locais da imagem.
 */
export function toLocalBoundingBox(
  absoluteBox: TransformerBoundBox,
  zoomLevel: number
): TransformerBoundBox {
  const safeZoom = zoomLevel > 0 ? zoomLevel : 1.0;
  return {
    x: absoluteBox.x / safeZoom,
    y: absoluteBox.y / safeZoom,
    width: absoluteBox.width / safeZoom,
    height: absoluteBox.height / safeZoom,
    rotation: absoluteBox.rotation,
  };
}

/**
 * Converte uma caixa delimitadora em coordenadas locais da imagem de volta para coordenadas absolutas do Stage.
 */
export function toAbsoluteBoundingBox(
  localBox: TransformerBoundBox,
  zoomLevel: number
): TransformerBoundBox {
  const safeZoom = zoomLevel > 0 ? zoomLevel : 1.0;
  return {
    x: localBox.x * safeZoom,
    y: localBox.y * safeZoom,
    width: localBox.width * safeZoom,
    height: localBox.height * safeZoom,
    rotation: localBox.rotation,
  };
}

/**
 * Calcula uma caixa delimitadora proporcional (sem distorção) ao redimensionar elementos
 * pelas laterais ("para o lado"), pelo topo/base ("para cima/baixo") ou pelos cantos.
 * Garante que a proporção entre largura e altura seja estritamente preservada (scaleX === scaleY),
 * impedindo distorções no conteúdo das formas e em suas cabeças de flechas.
 */
export function calculateProportionalResizeBox(
  oldBox: TransformerBoundBox,
  newBox: TransformerBoundBox,
  minDimension: number = 10
): TransformerBoundBox {
  if (oldBox.width <= 0 || oldBox.height <= 0) {
    return newBox;
  }

  const scaleX = newBox.width / oldBox.width;
  const scaleY = newBox.height / oldBox.height;

  // Se ambos os eixos já foram escalados por igual
  if (Math.abs(scaleX - scaleY) < 0.001) {
    return newBox;
  }

  // Se a largura mudou mais que a altura (arraste lateral / "para o lado")
  if (Math.abs(scaleX - 1) > Math.abs(scaleY - 1)) {
    const targetW = Math.max(minDimension, Math.round(oldBox.width * scaleX));
    const targetH = Math.max(minDimension, Math.round(oldBox.height * scaleX));
    const deltaW = targetW - oldBox.width;
    const movedLeft = Math.abs(newBox.x - oldBox.x) > 0.01;
    const nextX = movedLeft ? oldBox.x - deltaW : oldBox.x;
    const nextY = Math.round(oldBox.y - (targetH - oldBox.height) / 2);

    return {
      x: nextX,
      y: nextY,
      width: targetW,
      height: targetH,
      rotation: newBox.rotation,
    };
  }

  // Se a altura mudou mais que a largura (arraste vertical / "para cima")
  const targetH = Math.max(minDimension, Math.round(oldBox.height * scaleY));
  const targetW = Math.max(minDimension, Math.round(oldBox.width * scaleY));
  const deltaH = targetH - oldBox.height;
  const movedTop = Math.abs(newBox.y - oldBox.y) > 0.01;
  const nextY = movedTop ? oldBox.y - deltaH : oldBox.y;
  const nextX = Math.round(oldBox.x - (targetW - oldBox.width) / 2);

  return {
    x: nextX,
    y: nextY,
    width: targetW,
    height: targetH,
    rotation: newBox.rotation,
  };
}

/**
 * Restringe as coordenadas (x, y) de um retângulo ou imagem aos limites da imagem de fundo [0, canvas],
 * levando em conta dimensões reais, escala e rotação.
 */
export function clampRectToBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleX: number = 1,
  scaleY: number = 1,
  rotation: number = 0
): { x: number; y: number } {
  const safeW = Math.max(0, width * Math.abs(scaleX));
  const safeH = Math.max(0, height * Math.abs(scaleY));

  if (rotation === 0) {
    const maxX = Math.max(0, canvasWidth - safeW);
    const maxY = Math.max(0, canvasHeight - safeH);
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }

  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: 0, y: 0 },
    { x: safeW * cos, y: safeW * sin },
    { x: safeW * cos - safeH * sin, y: safeW * sin + safeH * cos },
    { x: -safeH * sin, y: safeH * cos },
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }

  const allowedMinX = -minX;
  const allowedMaxX = canvasWidth - maxX;
  const allowedMinY = -minY;
  const allowedMaxY = canvasHeight - maxY;

  const clampedX =
    allowedMaxX >= allowedMinX
      ? Math.max(allowedMinX, Math.min(x, allowedMaxX))
      : allowedMinX;
  const clampedY =
    allowedMaxY >= allowedMinY
      ? Math.max(allowedMinY, Math.min(y, allowedMaxY))
      : allowedMinY;

  return {
    x: clampedX,
    y: clampedY,
  };
}

/**
 * Restringe o centro (x, y) de uma elipse aos limites da imagem com base nos seus raios, escala e rotação.
 */
export function clampEllipseToBounds(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleX: number = 1,
  scaleY: number = 1,
  rotation: number = 0
): { x: number; y: number } {
  const rx = Math.max(0, radiusX * Math.abs(scaleX));
  const ry = Math.max(0, radiusY * Math.abs(scaleY));

  let extentX = rx;
  let extentY = ry;

  if (rotation !== 0) {
    const rad = (rotation * Math.PI) / 180;
    extentX = Math.sqrt(Math.pow(rx * Math.cos(rad), 2) + Math.pow(ry * Math.sin(rad), 2));
    extentY = Math.sqrt(Math.pow(rx * Math.sin(rad), 2) + Math.pow(ry * Math.cos(rad), 2));
  }

  const minX = Math.min(extentX, canvasWidth / 2);
  const maxX = Math.max(extentX, canvasWidth - extentX);
  const minY = Math.min(extentY, canvasHeight / 2);
  const maxY = Math.max(extentY, canvasHeight - extentY);

  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
  };
}

/**
 * Restringe o deslocamento (x, y) de uma linha ou seta para que todos os seus vértices (points),
 * considerando sua escala (scaleX, scaleY) e rotação (rotation), permaneçam estritamente
 * dentro da área total da imagem.
 */
export function clampLinePointsToBounds(
  x: number,
  y: number,
  points: number[],
  canvasWidth: number,
  canvasHeight: number,
  scaleX: number = 1,
  scaleY: number = 1,
  rotation: number = 0
): { x: number; y: number } {
  if (!points || points.length === 0) {
    return {
      x: Math.max(0, Math.min(x, canvasWidth)),
      y: Math.max(0, Math.min(y, canvasHeight)),
    };
  }

  const rad = rotation !== 0 ? (rotation * Math.PI) / 180 : 0;
  const cos = rotation !== 0 ? Math.cos(rad) : 1;
  const sin = rotation !== 0 ? Math.sin(rad) : 0;

  let minPtX = Infinity;
  let maxPtX = -Infinity;
  let minPtY = Infinity;
  let maxPtY = -Infinity;

  for (let i = 0; i < points.length; i += 2) {
    const rawPx = points[i] * scaleX;
    const rawPy = points[i + 1] * scaleY;

    const px = rotation !== 0 ? rawPx * cos - rawPy * sin : rawPx;
    const py = rotation !== 0 ? rawPx * sin + rawPy * cos : rawPy;

    if (px < minPtX) minPtX = px;
    if (px > maxPtX) maxPtX = px;
    if (py < minPtY) minPtY = py;
    if (py > maxPtY) maxPtY = py;
  }

  const minX = -minPtX;
  const maxX = canvasWidth - maxPtX;
  const minY = -minPtY;
  const maxY = canvasHeight - maxPtY;

  const clampedX = maxX >= minX ? Math.max(minX, Math.min(x, maxX)) : minX;
  const clampedY = maxY >= minY ? Math.max(minY, Math.min(y, maxY)) : minY;

  return {
    x: clampedX,
    y: clampedY,
  };
}

/**
 * Despachante universal para restringir qualquer tipo de anotação aos limites da imagem de fundo,
 * respeitando com exatidão a geometria escalada e rotacionada.
 */
export function clampAnnotationPositionToBounds(
  ann: Annotation,
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  nodeWidth?: number,
  nodeHeight?: number
): { x: number; y: number } {
  const sx = ann.scaleX ?? 1;
  const sy = ann.scaleY ?? 1;
  const rot = ann.rotation ?? 0;

  switch (ann.type) {
    case 'rect':
      return clampRectToBounds(x, y, ann.width, ann.height, canvasWidth, canvasHeight, sx, sy, rot);
    case 'image':
      return clampRectToBounds(x, y, ann.width, ann.height, canvasWidth, canvasHeight, sx, sy, rot);
    case 'ellipse':
      return clampEllipseToBounds(x, y, ann.radiusX, ann.radiusY, canvasWidth, canvasHeight, sx, sy, rot);
    case 'line':
    case 'arrow':
      return clampLinePointsToBounds(x, y, ann.points, canvasWidth, canvasHeight, sx, sy, rot);
    case 'text': {
      const w = nodeWidth ?? 120;
      const h = nodeHeight ?? 30;
      return clampRectToBounds(x, y, w, h, canvasWidth, canvasHeight, sx, sy, rot);
    }
    case 'magnifier': {
      const r = ann.radius;
      return {
        x: Math.max(r, Math.min(x, canvasWidth - r)),
        y: Math.max(r, Math.min(y, canvasHeight - r)),
      };
    }
    default:
      return {
        x: Math.max(0, Math.min(x, canvasWidth)),
        y: Math.max(0, Math.min(y, canvasHeight)),
      };
  }
}

export const ARROW_STROKE_STEPS = [2, 3, 4, 6, 8] as const;
export const ARROW_DEFAULT_STROKE = 4;

/**
 * Arredonda qualquer espessura para o passo mais próximo em ARROW_STROKE_STEPS [2, 3, 4, 6, 8],
 * travando estritamente nos limites mínimo (2) e máximo (8).
 */
export function snapToArrowStrokeStep(rawStroke: number): number {
  if (rawStroke <= ARROW_STROKE_STEPS[0]) return ARROW_STROKE_STEPS[0];
  if (rawStroke >= ARROW_STROKE_STEPS[ARROW_STROKE_STEPS.length - 1]) {
    return ARROW_STROKE_STEPS[ARROW_STROKE_STEPS.length - 1];
  }
  let closest: number = ARROW_STROKE_STEPS[0];
  let minDiff = Math.abs(rawStroke - closest);
  for (const step of ARROW_STROKE_STEPS) {
    const diff = Math.abs(rawStroke - step);
    if (diff < minDiff) {
      minDiff = diff;
      closest = step;
    }
  }
  return closest;
}

/**
 * Calcula a nova espessura da flecha em degraus de 2px a 8px ao ser redimensionada.
 */
export function calculateResizedArrowStroke(baseStroke: number, scaleFactor: number): number {
  const safeScale = Math.max(0.01, Math.abs(scaleFactor));
  const rawStroke = baseStroke * safeScale;
  return snapToArrowStrokeStep(rawStroke);
}

/**
 * Calcula dimensões proporcionais da ponta da flecha (pointerLength e pointerWidth)
 * garantindo que a ponta cresça/diminua proporcionalmente à espessura sem qualquer distorção.
 */
export function getArrowHeadDimensions(
  strokeWidth: number,
  arrowStyle: ArrowStyle = 'standard'
): { pointerLength: number; pointerWidth: number } {
  const safeStroke = Math.max(2, Math.min(8, strokeWidth));
  if (arrowStyle === 'thin') {
    return {
      pointerLength: Math.round(safeStroke * 4), // 8px para stroke 2
      pointerWidth: Math.round(safeStroke * 3), // 6px para stroke 2
    };
  }
  return {
    pointerLength: Math.round(safeStroke * 3.2), // 13px para stroke 4, 26px para stroke 8
    pointerWidth: Math.round(safeStroke * 2.5), // 10px para stroke 4, 20px para stroke 8
  };
}

/**
 * Calcula as coordenadas de 6 pontos [x1, y1, midX, midY, x2, y2] para flecha curva,
 * projetando o ponto médio perpendicularmente à corda para um arco suave.
 */
export function calculateCurvedArrowPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  direction: 'left' | 'right' = 'right',
  curvatureFactor: number = 0.25
): number[] {
  const chordMidX = (x1 + x2) / 2;
  const chordMidY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (len < 1e-4) {
    return [x1, y1, x1, y1, x2, y2];
  }

  // Normal perpendicular à corda
  const nx = -dy / len;
  const ny = dx / len;

  const offset = Math.max(10, Math.min(len * curvatureFactor, 100));
  const sign = direction === 'left' ? -1 : 1;

  const midX = Math.round(chordMidX + nx * offset * sign);
  const midY = Math.round(chordMidY + ny * offset * sign);

  return [x1, y1, midX, midY, x2, y2];
}

/**
 * Inverte a curvatura da flecha espelhando o ponto médio do arco em relação à corda,
 * mantendo as posições de início e fim intactas.
 */
export function invertCurvedArrowPoints(points: number[]): number[] {
  if (points.length < 6) return points;
  const [x1, y1, midX, midY, x2, y2] = points;
  const chordMidX = (x1 + x2) / 2;
  const chordMidY = (y1 + y2) / 2;
  const invertedMidX = Math.round(2 * chordMidX - midX);
  const invertedMidY = Math.round(2 * chordMidY - midY);
  return [x1, y1, invertedMidX, invertedMidY, x2, y2];
}

/**
 * Ajusta a caixa delimitadora do Transformer para flechas em degraus de espessura [2, 3, 4, 6, 8],
 * travando nos limites 2px (mínimo) e 8px (máximo) e mantendo proporções sem distorção.
 */
export function clampArrowResizeBox(
  oldBox: TransformerBoundBox,
  newBox: TransformerBoundBox,
  baseStrokeWidth: number,
  baseWidth: number,
  baseHeight: number
): TransformerBoundBox {
  if (Math.abs(newBox.rotation - oldBox.rotation) > 1e-4) {
    return newBox;
  }
  if (baseWidth <= 0 || baseHeight <= 0 || newBox.width <= 1 || newBox.height <= 1) {
    return oldBox;
  }

  const rawScale = Math.max(newBox.width / baseWidth, newBox.height / baseHeight);
  const snappedStroke = calculateResizedArrowStroke(baseStrokeWidth, rawScale);
  const snappedScale = snappedStroke / baseStrokeWidth;
  const snappedWidth = Number((baseWidth * snappedScale).toFixed(2));
  const snappedHeight = Number((baseHeight * snappedScale).toFixed(2));

  if (
    Math.abs(snappedWidth - oldBox.width) < 0.01 &&
    Math.abs(snappedHeight - oldBox.height) < 0.01
  ) {
    return oldBox;
  }

  const deltaWidth = newBox.width - oldBox.width;
  const ratio = Math.abs(deltaWidth) > 1e-4 ? (snappedWidth - oldBox.width) / deltaWidth : 0;
  const snappedX = Number((oldBox.x + (newBox.x - oldBox.x) * ratio).toFixed(2));
  const snappedY = Number((oldBox.y + (newBox.y - oldBox.y) * ratio).toFixed(2));

  return {
    x: snappedX,
    y: snappedY,
    width: snappedWidth,
    height: snappedHeight,
    rotation: newBox.rotation,
  };
}

/**
 * Define se o Transformer de redimensionamento do Konva deve ser acoplado ao tipo de bloco.
 * Retângulos, elipses, linhas e flechas utilizam âncoras dedicadas e minimalistas
 * estilo Snipping Tool do Windows (4 cantos livres e alça de rotação), suprimindo o Transformer retangular.
 */
export function shouldAttachTransformer(
  annotationType: ToolType | 'multi' | 'crop',
  _arrowStyle?: ArrowStyle
): boolean {
  if (annotationType === 'select') return false;
  if (
    annotationType === 'rect' ||
    annotationType === 'ellipse' ||
    annotationType === 'line' ||
    annotationType === 'arrow'
  ) {
    return false;
  }
  return true;
}

export interface FourCornerControls {
  corners: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }]; // 0: TL, 1: TR, 2: BR, 3: BL
  center: { x: number; y: number };
  rotater: { x: number; y: number };
}

/**
 * Rotaciona um ponto (x, y) ao redor de um centro (cx, cy) por um ângulo em graus.
 */
export function rotatePointAround(
  point: { x: number; y: number },
  center: { x: number; y: number },
  angleDeg: number
): { x: number; y: number } {
  if (angleDeg === 0) return { x: point.x, y: point.y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: Math.round(center.x + dx * cos - dy * sin),
    y: Math.round(center.y + dx * sin + dy * cos),
  };
}

/**
 * Calcula as posições dos 4 cantos e do botão de rotação superior para retângulo e elipse,
 * suportando rotação livre ao redor do centro.
 */
export function getFourCornerPositions(ann: Annotation): FourCornerControls {
  const rot = ann.rotation ?? 0;
  let cx = 0;
  let cy = 0;
  let unrotatedTL = { x: 0, y: 0 };
  let unrotatedTR = { x: 0, y: 0 };
  let unrotatedBR = { x: 0, y: 0 };
  let unrotatedBL = { x: 0, y: 0 };
  let unrotatedRotater = { x: 0, y: 0 };

  if (ann.type === 'rect') {
    const w = ann.width;
    const h = ann.height;
    cx = ann.x + w / 2;
    cy = ann.y + h / 2;
    unrotatedTL = { x: ann.x, y: ann.y };
    unrotatedTR = { x: ann.x + w, y: ann.y };
    unrotatedBR = { x: ann.x + w, y: ann.y + h };
    unrotatedBL = { x: ann.x, y: ann.y + h };
    unrotatedRotater = { x: cx, y: ann.y - 28 };
  } else if (ann.type === 'ellipse') {
    cx = ann.x;
    cy = ann.y;
    const rx = ann.radiusX;
    const ry = ann.radiusY;
    unrotatedTL = { x: cx - rx, y: cy - ry };
    unrotatedTR = { x: cx + rx, y: cy - ry };
    unrotatedBR = { x: cx + rx, y: cy + ry };
    unrotatedBL = { x: cx - rx, y: cy + ry };
    unrotatedRotater = { x: cx, y: cy - ry - 28 };
  }

  const center = { x: cx, y: cy };
  return {
    corners: [
      rotatePointAround(unrotatedTL, center, rot),
      rotatePointAround(unrotatedTR, center, rot),
      rotatePointAround(unrotatedBR, center, rot),
      rotatePointAround(unrotatedBL, center, rot),
    ],
    center,
    rotater: rotatePointAround(unrotatedRotater, center, rot),
  };
}

/**
 * Redimensiona retângulo ou elipse movendo um dos 4 cantos livres
 * enquanto mantém o canto diagonalmente oposto firmemente ancorado.
 */
export function updateCornerResize(
  ann: Annotation,
  cornerIndex: 0 | 1 | 2 | 3, // 0: TL, 1: TR, 2: BR, 3: BL
  pointer: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): Partial<Annotation> {
  const px = Math.max(0, Math.min(pointer.x, canvasWidth));
  const py = Math.max(0, Math.min(pointer.y, canvasHeight));
  const rot = ann.rotation ?? 0;

  // Se rotação for 0, cálculo direto e exato
  if (rot === 0) {
    if (ann.type === 'rect') {
      const minDim = 10;
      if (cornerIndex === 2) {
        // BR arrastado: TL (ann.x, ann.y) fica fixo
        const w = Math.max(minDim, px - ann.x);
        const h = Math.max(minDim, py - ann.y);
        return { x: ann.x, y: ann.y, width: w, height: h };
      }
      if (cornerIndex === 1) {
        // TR arrastado: BL (ann.x, ann.y + ann.height) fica fixo
        const blY = ann.y + ann.height;
        const w = Math.max(minDim, px - ann.x);
        const h = Math.max(minDim, blY - py);
        return { x: ann.x, y: blY - h, width: w, height: h };
      }
      if (cornerIndex === 3) {
        // BL arrastado: TR (ann.x + ann.width, ann.y) fica fixo
        const trX = ann.x + ann.width;
        const w = Math.max(minDim, trX - px);
        const h = Math.max(minDim, py - ann.y);
        return { x: trX - w, y: ann.y, width: w, height: h };
      }
      if (cornerIndex === 0) {
        // TL arrastado: BR (ann.x + ann.width, ann.y + ann.height) fica fixo
        const brX = ann.x + ann.width;
        const brY = ann.y + ann.height;
        const w = Math.max(minDim, brX - px);
        const h = Math.max(minDim, brY - py);
        return { x: brX - w, y: brY - h, width: w, height: h };
      }
    } else if (ann.type === 'ellipse') {
      const minRadius = 5;
      if (cornerIndex === 2) {
        // BR arrastado: TL (ann.x - ann.radiusX, ann.y - ann.radiusY) fica fixo
        const tlX = ann.x - ann.radiusX;
        const tlY = ann.y - ann.radiusY;
        const w = Math.max(minRadius * 2, px - tlX);
        const h = Math.max(minRadius * 2, py - tlY);
        const rx = Math.round(w / 2);
        const ry = Math.round(h / 2);
        return { x: tlX + rx, y: tlY + ry, radiusX: rx, radiusY: ry };
      }
      if (cornerIndex === 1) {
        // TR arrastado: BL (ann.x - ann.radiusX, ann.y + ann.radiusY) fica fixo
        const blX = ann.x - ann.radiusX;
        const blY = ann.y + ann.radiusY;
        const w = Math.max(minRadius * 2, px - blX);
        const h = Math.max(minRadius * 2, blY - py);
        const rx = Math.round(w / 2);
        const ry = Math.round(h / 2);
        return { x: blX + rx, y: blY - ry, radiusX: rx, radiusY: ry };
      }
      if (cornerIndex === 3) {
        // BL arrastado: TR (ann.x + ann.radiusX, ann.y - ann.radiusY) fica fixo
        const trX = ann.x + ann.radiusX;
        const trY = ann.y - ann.radiusY;
        const w = Math.max(minRadius * 2, trX - px);
        const h = Math.max(minRadius * 2, py - trY);
        const rx = Math.round(w / 2);
        const ry = Math.round(h / 2);
        return { x: trX - rx, y: trY + ry, radiusX: rx, radiusY: ry };
      }
      if (cornerIndex === 0) {
        // TL arrastado: BR (ann.x + ann.radiusX, ann.y + ann.radiusY) fica fixo
        const brX = ann.x + ann.radiusX;
        const brY = ann.y + ann.radiusY;
        const w = Math.max(minRadius * 2, brX - px);
        const h = Math.max(minRadius * 2, brY - py);
        const rx = Math.round(w / 2);
        const ry = Math.round(h / 2);
        return { x: brX - rx, y: brY - ry, radiusX: rx, radiusY: ry };
      }
    }
  }

  // Se tipo não for rect ou ellipse, ignora
  if (ann.type !== 'rect' && ann.type !== 'ellipse') {
    return {};
  }

  // Com rotação não-nula: converte o ponteiro para o sistema de coordenadas local
  const cx = ann.type === 'rect' ? ann.x + ann.width / 2 : ann.x;
  const cy = ann.type === 'rect' ? ann.y + ann.height / 2 : ann.y;
  const localPointer = rotatePointAround({ x: px, y: py }, { x: cx, y: cy }, -rot);

  // Calcula no sistema não-rotacionado
  const unrotatedAnn: Annotation =
    ann.type === 'rect'
      ? { ...ann, rotation: 0 }
      : { ...ann, rotation: 0 };
  const unrotatedRes = updateCornerResize(unrotatedAnn, cornerIndex, localPointer, canvasWidth, canvasHeight);

  if (ann.type === 'rect') {
    const rectRes = unrotatedRes as { x?: number; y?: number; width?: number; height?: number };
    if (rectRes.width !== undefined && rectRes.height !== undefined && rectRes.x !== undefined && rectRes.y !== undefined) {
      const unrotatedNewCenter = {
        x: rectRes.x + rectRes.width / 2,
        y: rectRes.y + rectRes.height / 2,
      };
      const worldNewCenter = rotatePointAround(unrotatedNewCenter, { x: cx, y: cy }, rot);
      const rad = (rot * Math.PI) / 180;
      const w = rectRes.width;
      const h = rectRes.height;
      const newRectX = Math.round(worldNewCenter.x - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad));
      const newRectY = Math.round(worldNewCenter.y - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad));
      return {
        x: newRectX,
        y: newRectY,
        width: w,
        height: h,
      };
    }
  } else if (ann.type === 'ellipse') {
    const ellipseRes = unrotatedRes as { x?: number; y?: number; radiusX?: number; radiusY?: number };
    if (ellipseRes.x !== undefined && ellipseRes.y !== undefined && ellipseRes.radiusX !== undefined && ellipseRes.radiusY !== undefined) {
      const worldNewCenter = rotatePointAround({ x: ellipseRes.x, y: ellipseRes.y }, { x: cx, y: cy }, rot);
      return {
        x: worldNewCenter.x,
        y: worldNewCenter.y,
        radiusX: ellipseRes.radiusX,
        radiusY: ellipseRes.radiusY,
      };
    }
  }

  return {};
}

/**
 * Calcula o ângulo de rotação de 0 a 360 graus ao arrastar a alça circular superior ao redor do centro da forma.
 */
export function updateShapeRotation(
  ann: Annotation,
  pointer: { x: number; y: number }
): number {
  let cx = ann.x ?? 0;
  let cy = ann.y ?? 0;
  if (ann.type === 'rect') {
    cx = ann.x + ann.width / 2;
    cy = ann.y + ann.height / 2;
  }
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI) + 90;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

export type TwoPointAnchorType = 'start' | 'end';

/**
 * Extrai as posições relativas das 2 âncoras de extremidade (linha ou seta reta):
 * - start: origem / cauda (x1, y1)
 * - end: destino / ponta (x2, y2)
 */
export function getTwoPointAnchorPositions(points: number[]): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  return {
    start: { x: points[0] ?? 0, y: points[1] ?? 0 },
    end: { x: points[2] ?? 0, y: points[3] ?? 0 },
  };
}

/**
 * Atualiza uma âncora específica de linha ou seta reta (0=origem/cauda, 1=destino/ponta),
 * aplicando contenção rígida aos limites da imagem [0..canvasWidth, 0..canvasHeight].
 */
export function updateTwoPointAnchor(
  points: number[],
  anchorIndex: 0 | 1,
  newX: number,
  newY: number,
  canvasWidth: number,
  canvasHeight: number
): number[] {
  const clampedX = Math.round(Math.max(0, Math.min(newX, canvasWidth)));
  const clampedY = Math.round(Math.max(0, Math.min(newY, canvasHeight)));

  const result = [...points];
  while (result.length < 4) {
    result.push(0);
  }

  const offset = anchorIndex * 2;
  result[offset] = clampedX;
  result[offset + 1] = clampedY;

  return result;
}

export type CurvedArrowAnchorType = 'tail' | 'bend' | 'tip';

/**
 * Extrai as posições relativas das 3 âncoras da flecha curva:
 * - tail: cauda / origem (x1, y1)
 * - bend: ápice da curvatura (midX, midY)
 * - tip: ponta / alvo (x2, y2)
 */
export function getCurvedArrowAnchorPositions(points: number[]): {
  tail: { x: number; y: number };
  bend: { x: number; y: number };
  tip: { x: number; y: number };
} {
  return {
    tail: { x: points[0] ?? 0, y: points[1] ?? 0 },
    bend: { x: points[2] ?? 0, y: points[3] ?? 0 },
    tip: { x: points[4] ?? 0, y: points[5] ?? 0 },
  };
}

/**
 * Atualiza uma âncora específica da flecha curva (0=cauda, 1=arco, 2=ponta),
 * aplicando contenção rígida aos limites da imagem [0..canvasWidth, 0..canvasHeight].
 */
export function updateCurvedArrowAnchor(
  points: number[],
  anchorIndex: 0 | 1 | 2,
  newX: number,
  newY: number,
  canvasWidth: number,
  canvasHeight: number
): number[] {
  const clampedX = Math.round(Math.max(0, Math.min(newX, canvasWidth)));
  const clampedY = Math.round(Math.max(0, Math.min(newY, canvasHeight)));

  const result = [...points];
  while (result.length < 6) {
    result.push(0);
  }

  const offset = anchorIndex * 2;
  result[offset] = clampedX;
  result[offset + 1] = clampedY;

  return result;
}

/**
 * Retorna o cursor de redimensionamento bidirecional (duas setas de cada lado) apropriado
 * para um dos 4 cantos (0: TL, 1: TR, 2: BR, 3: BL), levando em consideração
 * a rotação atual da forma (0 a 360 graus).
 */
export function getCornerCursor(cornerIndex: 0 | 1 | 2 | 3, rotation: number = 0): string {
  // Ângulos base de cada canto relativo ao centro da forma
  const baseAngles = [315, 45, 135, 225];
  const angle = (baseAngles[cornerIndex] + rotation) % 360;
  const normalized = (angle < 0 ? angle + 360 : angle) % 360;

  // 8 setores de 45 graus cada (com offset de 22.5 graus)
  if (normalized >= 22.5 && normalized < 67.5) {
    return 'nesw-resize';
  }
  if (normalized >= 67.5 && normalized < 112.5) {
    return 'ew-resize';
  }
  if (normalized >= 112.5 && normalized < 157.5) {
    return 'nwse-resize';
  }
  if (normalized >= 157.5 && normalized < 202.5) {
    return 'ns-resize';
  }
  if (normalized >= 202.5 && normalized < 247.5) {
    return 'nesw-resize';
  }
  if (normalized >= 247.5 && normalized < 292.5) {
    return 'ew-resize';
  }
  if (normalized >= 292.5 && normalized < 337.5) {
    return 'nwse-resize';
  }
  return 'ns-resize';
}
