import { describe, it, expect } from 'vitest';
import { isPointInsideTextAnnotation } from '../src/utils/textStyle';
import { Annotation } from '../src/state/editorStore';

describe('isPointInsideTextAnnotation', () => {
  it('returns false for non-text annotations', () => {
    const rectAnn: Annotation = {
      id: 'rect-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      stroke: '#ff0000',
      strokeWidth: 2,
    };
    expect(isPointInsideTextAnnotation({ x: 150, y: 150 }, rectAnn)).toBe(false);
  });

  it('detects points inside an unrotated text box including empty area ahead of words', () => {
    const textAnn: Annotation = {
      id: 'text-1',
      type: 'text',
      x: 100,
      y: 100,
      text: 'Hello World',
      fontSize: 20,
      width: 300,
      autoWrap: true,
      hasBackground: false,
    };

    // Ponto no centro do bloco
    expect(isPointInsideTextAnnotation({ x: 200, y: 110 }, textAnn)).toBe(true);

    // Ponto à frente da palavra "Hello World", ainda dentro da largura de 300px
    expect(isPointInsideTextAnnotation({ x: 280, y: 110 }, textAnn)).toBe(true);

    // Ponto fora do bloco (à esquerda)
    expect(isPointInsideTextAnnotation({ x: 90, y: 110 }, textAnn)).toBe(false);

    // Ponto fora do bloco (à direita além dos 300px)
    expect(isPointInsideTextAnnotation({ x: 420, y: 110 }, textAnn)).toBe(false);

    // Ponto fora do bloco (abaixo)
    expect(isPointInsideTextAnnotation({ x: 200, y: 200 }, textAnn)).toBe(false);
  });

  it('detects points accurately when text is rotated 90 degrees', () => {
    // Bloco em (100, 100) com width=200, height=50, rotacionado 90 graus
    // Centro: (100 + 100, 100 + 25) = (200, 125)
    // Com 90 deg, a largura vira vertical e a altura vira horizontal
    const textAnn: Annotation = {
      id: 'text-rot',
      type: 'text',
      x: 100,
      y: 100,
      text: 'Texto Rotacionado',
      fontSize: 20,
      width: 200,
      autoWrap: true,
      rotation: 90,
    };

    // Ponto no centro geométrico (200, 125)
    expect(isPointInsideTextAnnotation({ x: 200, y: 125 }, textAnn)).toBe(true);

    // No sistema unrotated: (250, 125) -> dx=+50, dy=0
    // Com rotação de 90 graus: (200, 125 + 50) = (200, 175)
    expect(isPointInsideTextAnnotation({ x: 200, y: 175 }, textAnn)).toBe(true);

    // Fora do bloco rotacionado: (300, 125) que seria fora
    expect(isPointInsideTextAnnotation({ x: 300, y: 125 }, textAnn)).toBe(false);
  });
});
