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
