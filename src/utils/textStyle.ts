export type TextAlign = 'left' | 'center' | 'right';

/**
 * Mapeia os estados booleanos de Negrito e Itálico para o atributo `fontStyle` esperado pelo Konva.
 */
export function resolveKonvaFontStyle(isBold?: boolean, isItalic?: boolean): string {
  if (isBold && isItalic) {
    return 'italic bold';
  }
  if (isBold) {
    return 'bold';
  }
  if (isItalic) {
    return 'italic';
  }
  return 'normal';
}

/**
 * Mapeia os estados booleanos de Sublinhado e Riscado para o atributo `textDecoration` do Konva.
 */
export function resolveKonvaTextDecoration(
  isUnderline?: boolean,
  isStrikethrough?: boolean
): string {
  if (isUnderline && isStrikethrough) {
    return 'underline line-through';
  }
  if (isUnderline) {
    return 'underline';
  }
  if (isStrikethrough) {
    return 'line-through';
  }
  return '';
}

/**
 * Gera as propriedades CSS equivalentes para o `<textarea>` de edição rápida inline.
 */
export function resolveTextCssStyle(
  isBold?: boolean,
  isItalic?: boolean,
  isUnderline?: boolean,
  isStrikethrough?: boolean
): {
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
} {
  const textDecParts: string[] = [];
  if (isUnderline) textDecParts.push('underline');
  if (isStrikethrough) textDecParts.push('line-through');

  return {
    fontWeight: isBold ? 'bold' : 'normal',
    fontStyle: isItalic ? 'italic' : 'normal',
    textDecoration: textDecParts.length > 0 ? textDecParts.join(' ') : 'none',
  };
}
