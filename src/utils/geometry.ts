import { Point, RectBounds } from '../types/capture';

/**
 * Normaliza um retângulo de seleção independentemente da direção em que o usuário arrastou o mouse
 * (ex: de baixo para cima ou da direita para a esquerda).
 */
export function calculateNormalizedRect(start: Point, current: Point): RectBounds {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);

  return { x, y, width, height };
}

/**
 * Limita as coordenadas de um ponto para dentro da resolução visível da tela.
 */
export function clampPointToScreen(point: Point, screenWidth: number, screenHeight: number): Point {
  return {
    x: Math.max(0, Math.min(point.x, screenWidth)),
    y: Math.max(0, Math.min(point.y, screenHeight)),
  };
}

/**
 * Reduz a densidade de pontos em um corte livre (lasso/freeform), removendo pontos
 * redundantes que estejam a uma distância menor que o threshold mínimo.
 */
export function simplifyFreeformPath(points: Point[], minDistance: number = 3): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);

    if (dist >= minDistance) {
      result.push(curr);
    }
  }

  return result;
}
