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

/**
 * Verifica se um elemento ou o alvo do evento é um campo de texto editável
 * (input, textarea ou elemento contentEditable e seus filhos), garantindo que
 * atalhos globais de canvas (Delete, Backspace, Ctrl+Z, Ctrl+Y, Escape, etc.)
 * não interfiram ou apaguem blocos durante a digitação.
 */
export function isEditingTextElement(target: EventTarget | null | any): boolean {
  if (!target) return false;

  const isInput =
    (typeof HTMLInputElement !== 'undefined' && target instanceof HTMLInputElement) ||
    target.tagName === 'INPUT';
  const isTextArea =
    (typeof HTMLTextAreaElement !== 'undefined' && target instanceof HTMLTextAreaElement) ||
    target.tagName === 'TEXTAREA';

  if (isInput || isTextArea) {
    return true;
  }

  if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true') {
    return true;
  }

  if (typeof target.closest === 'function') {
    const editable = target.closest('[contenteditable="true"]');
    if (editable) {
      return true;
    }
  }

  if (target.parentElement) {
    return isEditingTextElement(target.parentElement);
  }

  return false;
}

export interface TextSpan {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
}

/**
 * Converte HTML gerado por um editor contentEditable em texto plano + spans com estilos individuais.
 */
export function parseHtmlToSpans(container: HTMLElement | string): {
  text: string;
  spans?: TextSpan[];
} {
  if (typeof container === 'string' && typeof document === 'undefined') {
    // Parser fallback para ambientes Node/headless sem DOM
    const tokens = container.split(/(<\/?[a-z0-9]+[^>]*>)/i);
    const rawSpans: TextSpan[] = [];
    const state = { isBold: false, isItalic: false, isUnderline: false, isStrikethrough: false };

    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();
      if (lower.startsWith('<')) {
        if (lower.startsWith('<br')) {
          rawSpans.push({ text: '\n' });
        } else if (lower.startsWith('<div') || lower.startsWith('<p')) {
          if (rawSpans.length > 0 && !rawSpans[rawSpans.length - 1].text.endsWith('\n')) {
            rawSpans.push({ text: '\n' });
          }
        } else if (lower.startsWith('</')) {
          if (lower.startsWith('</b') || lower.startsWith('</strong')) state.isBold = false;
          if (lower.startsWith('</i') || lower.startsWith('</em')) state.isItalic = false;
          if (lower.startsWith('</u')) state.isUnderline = false;
          if (lower.startsWith('</s')) state.isStrikethrough = false;
        } else {
          if (lower.startsWith('<b') || lower.startsWith('<strong')) state.isBold = true;
          if (lower.startsWith('<i') || lower.startsWith('<em')) state.isItalic = true;
          if (lower.startsWith('<u')) state.isUnderline = true;
          if (lower.startsWith('<s') || lower.startsWith('<strike') || lower.startsWith('<del')) state.isStrikethrough = true;
        }
      } else {
        rawSpans.push({
          text: token,
          isBold: state.isBold || undefined,
          isItalic: state.isItalic || undefined,
          isUnderline: state.isUnderline || undefined,
          isStrikethrough: state.isStrikethrough || undefined,
        });
      }
    }

    return finalizeSpans(rawSpans);
  }

  let root: HTMLElement;
  if (typeof container === 'string') {
    root = document.createElement('div');
    root.innerHTML = container;
  } else {
    root = container;
  }

  const rawSpans: TextSpan[] = [];

  function traverse(
    node: Node,
    state: { isBold: boolean; isItalic: boolean; isUnderline: boolean; isStrikethrough: boolean }
  ) {
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.nodeValue || '';
      if (val.length > 0) {
        rawSpans.push({
          text: val,
          isBold: state.isBold || undefined,
          isItalic: state.isItalic || undefined,
          isUnderline: state.isUnderline || undefined,
          isStrikethrough: state.isStrikethrough || undefined,
        });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        rawSpans.push({ text: '\n' });
        return;
      }

      const isBlock = tag === 'div' || tag === 'p';
      if (isBlock && rawSpans.length > 0 && !rawSpans[rawSpans.length - 1].text.endsWith('\n')) {
        rawSpans.push({ text: '\n' });
      }

      const isBold =
        state.isBold ||
        tag === 'b' ||
        tag === 'strong' ||
        el.style.fontWeight === 'bold' ||
        parseInt(el.style.fontWeight, 10) >= 600;

      const isItalic =
        state.isItalic ||
        tag === 'i' ||
        tag === 'em' ||
        el.style.fontStyle === 'italic';

      const isUnderline =
        state.isUnderline ||
        tag === 'u' ||
        el.style.textDecoration.includes('underline');

      const isStrikethrough =
        state.isStrikethrough ||
        tag === 's' ||
        tag === 'strike' ||
        tag === 'del' ||
        el.style.textDecoration.includes('line-through');

      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i], { isBold, isItalic, isUnderline, isStrikethrough });
      }
    }
  }

  traverse(root, { isBold: false, isItalic: false, isUnderline: false, isStrikethrough: false });

  return finalizeSpans(rawSpans, root);
}

function finalizeSpans(rawSpans: TextSpan[], root?: HTMLElement): { text: string; spans?: TextSpan[] } {
  const fallback = root && typeof root.innerText === "string" ? root.innerText : "";
  if (rawSpans.length === 0) {
    return { text: fallback };
  }

  // Mescla spans consecutivos com a mesma formatação
  const mergedSpans: TextSpan[] = [];
  for (const span of rawSpans) {
    if (mergedSpans.length === 0) {
      mergedSpans.push({ ...span });
      continue;
    }
    const prev = mergedSpans[mergedSpans.length - 1];
    const sameFormat =
      Boolean(prev.isBold) === Boolean(span.isBold) &&
      Boolean(prev.isItalic) === Boolean(span.isItalic) &&
      Boolean(prev.isUnderline) === Boolean(span.isUnderline) &&
      Boolean(prev.isStrikethrough) === Boolean(span.isStrikethrough);

    if (sameFormat) {
      prev.text += span.text;
    } else {
      mergedSpans.push({ ...span });
    }
  }

  const fullText = mergedSpans.map((s) => s.text).join('') || fallback;

  const hasFormattingVariation = mergedSpans.some(
    (s) =>
      Boolean(s.isBold) ||
      Boolean(s.isItalic) ||
      Boolean(s.isUnderline) ||
      Boolean(s.isStrikethrough)
  );

  return {
    text: fullText,
    spans: hasFormattingVariation ? mergedSpans : undefined,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converte spans ou texto base para HTML compatível com o elemento contentEditable.
 */
export function spansToHtml(
  text: string,
  spans?: TextSpan[],
  baseStyle?: {
    isBold?: boolean;
    isItalic?: boolean;
    isUnderline?: boolean;
    isStrikethrough?: boolean;
  }
): string {
  if (spans && spans.length > 0) {
    return spans
      .map((s) => {
        let content = escapeHtml(s.text).replace(/\n/g, '<br>');
        if (s.isStrikethrough) content = `<s>${content}</s>`;
        if (s.isUnderline) content = `<u>${content}</u>`;
        if (s.isItalic) content = `<i>${content}</i>`;
        if (s.isBold) content = `<b>${content}</b>`;
        return content;
      })
      .join('');
  }

  let content = escapeHtml(text).replace(/\n/g, '<br>');
  if (baseStyle?.isStrikethrough) content = `<s>${content}</s>`;
  if (baseStyle?.isUnderline) content = `<u>${content}</u>`;
  if (baseStyle?.isItalic) content = `<i>${content}</i>`;
  if (baseStyle?.isBold) content = `<b>${content}</b>`;
  return content;
}

/**
 * Divide uma lista de spans em linhas com base em quebras de linha (`\n`).
 */
export function splitSpansIntoLines(spans: TextSpan[]): TextSpan[][] {
  const lines: TextSpan[][] = [[]];

  for (const span of spans) {
    const parts = span.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push([]);
      }
      if (parts[i].length > 0) {
        lines[lines.length - 1].push({
          ...span,
          text: parts[i],
        });
      }
    }
  }

  return lines;
}

let measurementCanvas: HTMLCanvasElement | null = null;
let measurementCtx: CanvasRenderingContext2D | null = null;

/**
 * Mede a largura precisa em pixels de um trecho de texto no canvas ou fallback.
 */
export function measureSpanWidth(
  text: string,
  fontSize: number,
  fontFamily: string = 'Arial',
  isBold?: boolean,
  isItalic?: boolean
): number {
  if (!text) return 0;
  if (typeof document !== 'undefined') {
    if (!measurementCanvas) {
      measurementCanvas = document.createElement('canvas');
      measurementCtx = measurementCanvas.getContext('2d');
    }
    if (measurementCtx) {
      const fontStyle = resolveKonvaFontStyle(isBold, isItalic);
      measurementCtx.font = `${fontStyle === 'normal' ? '' : fontStyle + ' '}${fontSize}px ${fontFamily}`;
      const measured = measurementCtx.measureText(text).width;
      if (measured > 0) {
        return measured;
      }
    }
  }
  // Estimativa segura para ambiente de teste headless
  return text.length * (fontSize * 0.58);
}
