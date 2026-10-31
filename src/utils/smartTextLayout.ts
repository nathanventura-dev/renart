import { AnonymizedLine } from './textAnonymizer';

export interface RenderableSmartTextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface BoxDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcula o posicionamento e escala relativos de cada linha de texto sintético dentro da caixa de censura.
 */
export function calculateSmartTextLayout(
  lines: AnonymizedLine[] | undefined,
  currentRect: BoxDimensions,
  originalRect: Partial<BoxDimensions>
): RenderableSmartTextLine[] {
  if (!lines || lines.length === 0) {
    return [];
  }

  const origW = originalRect.width || currentRect.width || 1;
  const origH = originalRect.height || currentRect.height || 1;
  const origX = originalRect.x ?? currentRect.x ?? 0;
  const origY = originalRect.y ?? currentRect.y ?? 0;

  const scaleX = currentRect.width / origW;
  const scaleY = currentRect.height / origH;

  return lines.map((line) => {
    const rawLocalX = line.x - origX;
    const rawLocalY = line.y - origY;

    const localX = Math.round(rawLocalX * scaleX);
    const localY = Math.round(rawLocalY * scaleY);
    const localW = Math.round(line.width * scaleX);
    const localH = Math.round(line.height * scaleY);
    const fontSize = Math.max(9, Math.round(localH * 0.75));

    return {
      text: line.replacementText || line.text,
      x: localX,
      y: localY,
      width: localW,
      height: localH,
      fontSize,
    };
  });
}
