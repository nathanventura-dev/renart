import { Annotation } from '../state/editorStore';

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
