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

/**
 * Remove quebras de linha e espaços em branco vazios do final de uma lista de TextSpan.
 */
export function trimSpans(spans?: TextSpan[]): TextSpan[] | undefined {
  if (!spans || spans.length === 0) return undefined;
  const result: TextSpan[] = spans.map((s) => ({ ...s }));

  while (result.length > 0) {
    const last = result[result.length - 1];
    const trimmedRight = last.text.replace(/[\r\n\s]+$/, '');
    if (trimmedRight.length === 0) {
      result.pop();
    } else {
      last.text = trimmedRight;
      break;
    }
  }

  return result.length > 0 ? result : undefined;
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

  const trimmedMerged = trimSpans(mergedSpans) || [];
  const fullText = (trimmedMerged.length > 0 ? trimmedMerged.map((s) => s.text).join('') : mergedSpans.map((s) => s.text).join('')) || fallback;

  const hasFormattingVariation = trimmedMerged.some(
    (s) =>
      Boolean(s.isBold) ||
      Boolean(s.isItalic) ||
      Boolean(s.isUnderline) ||
      Boolean(s.isStrikethrough)
  );

  return {
    text: fullText,
    spans: hasFormattingVariation ? trimmedMerged : undefined,
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

/**
 * Remove espaços em branco do final de uma linha de TextSpan.
 */
function trimLineTrailingSpans(line: TextSpan[]): TextSpan[] {
  const result = line.map((s) => ({ ...s }));
  while (result.length > 0) {
    const last = result[result.length - 1];
    const trimmed = last.text.replace(/[\s\uFEFF\xA0]+$/, '');
    if (trimmed.length === 0) {
      result.pop();
    } else {
      last.text = trimmed;
      break;
    }
  }
  return result;
}

/**
 * Quebra spans em linhas respeitando quebras manuais de \n e, se maxWidth estiver definido,
 * quebrando suavemente entre palavras (auto-wrap).
 */
export function wrapSpansToWidth(
  spans: TextSpan[],
  maxWidth?: number,
  fontSize: number = 16,
  fontFamily: string = 'Arial'
): TextSpan[][] {
  const manualLines = splitSpansIntoLines(spans);
  if (!maxWidth || maxWidth <= 0) {
    return manualLines;
  }

  const resultLines: TextSpan[][] = [];

  for (const lineSpans of manualLines) {
    let currentLine: TextSpan[] = [];
    let currentLineWidth = 0;

    for (const span of lineSpans) {
      const words = span.text.match(/\S+|\s+/g) || [span.text];

      for (const word of words) {
        const isWhitespace = word.trim().length === 0;

        // Se uma nova linha está vazia após uma quebra suave, ignoramos espaços em branco iniciais
        if (currentLine.length === 0 && isWhitespace) {
          continue;
        }

        const wordWidth = measureSpanWidth(
          word,
          fontSize,
          fontFamily,
          span.isBold,
          span.isItalic
        );

        if (currentLineWidth + wordWidth > maxWidth && currentLine.length > 0) {
          if (!isWhitespace) {
            // Quebra suave: finaliza a linha atual sem espaços em branco no final
            const finalized = trimLineTrailingSpans(currentLine);
            if (finalized.length > 0) {
              resultLines.push(finalized);
            }
            currentLine = [];
            currentLineWidth = 0;
          } else {
            // Se o próprio espaço em branco estourar maxWidth, descartamos o espaço e quebramos
            const finalized = trimLineTrailingSpans(currentLine);
            if (finalized.length > 0) {
              resultLines.push(finalized);
            }
            currentLine = [];
            currentLineWidth = 0;
            continue;
          }
        }

        if (
          currentLine.length > 0 &&
          currentLine[currentLine.length - 1].isBold === span.isBold &&
          currentLine[currentLine.length - 1].isItalic === span.isItalic &&
          currentLine[currentLine.length - 1].isUnderline === span.isUnderline &&
          currentLine[currentLine.length - 1].isStrikethrough === span.isStrikethrough
        ) {
          currentLine[currentLine.length - 1].text += word;
        } else {
          currentLine.push({
            ...span,
            text: word,
          });
        }
        currentLineWidth += wordWidth;
      }
    }

    const finalized = trimLineTrailingSpans(currentLine);
    if (finalized.length > 0) {
      resultLines.push(finalized);
    } else if (lineSpans.length === 0) {
      resultLines.push([]);
    }
  }

  return resultLines.length > 0 ? resultLines : [[]];
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

/**
 * Calcula as dimensões (largura e altura) aproximadas ou medidas de um bloco de texto,
 * considerando quebras manuais (\n), quebra automática (autoWrap), formatação de spans e preenchimento de fundo.
 */
export function calculateTextDimensions(ann: {
  text?: string;
  spans?: TextSpan[];
  fontSize?: number;
  fontFamily?: string;
  hasBackground?: boolean;
  autoWrap?: boolean;
  width?: number;
  height?: number;
  isBold?: boolean;
  isItalic?: boolean;
}): { width: number; height: number; minWidth: number; minHeight: number } {
  const padX = ann.hasBackground ? 8 : 0;
  const padY = ann.hasBackground ? 4 : 0;
  const fontSize = ann.fontSize || 20;
  const fontFamily = ann.fontFamily || 'Arial';

  const effectiveSpans: TextSpan[] =
    ann.spans && ann.spans.length > 0
      ? ann.spans
      : ann.text
      ? [{ text: ann.text, isBold: ann.isBold, isItalic: ann.isItalic }]
      : [];

  let minContentWidth = 0;
  let naturalWidth = 0;
  let contentHeight = fontSize * 1.3 + padY * 2;

  if (effectiveSpans.length > 0) {
    let maxWordW = 0;
    for (const span of effectiveSpans) {
      const words = span.text.split(/(\s+)/);
      for (const w of words) {
        if (w.trim()) {
          const wWidth = measureSpanWidth(
            w,
            fontSize,
            fontFamily,
            span.isBold ?? ann.isBold,
            span.isItalic ?? ann.isItalic
          );
          if (wWidth > maxWordW) maxWordW = wWidth;
        }
      }
    }
    minContentWidth = Math.max(10, maxWordW + padX * 2);

    const targetWrapWidth =
      ann.autoWrap && ann.width ? Math.max(minContentWidth - padX * 2, ann.width - padX * 2) : undefined;
    const lines = wrapSpansToWidth(effectiveSpans, targetWrapWidth, fontSize, fontFamily);
    const lineCalculations = lines.map((lineSpans) => {
      let w = 0;
      for (const span of lineSpans) {
        w += measureSpanWidth(
          span.text,
          fontSize,
          fontFamily,
          span.isBold ?? ann.isBold,
          span.isItalic ?? ann.isItalic
        );
      }
      return w;
    });
    const maxLineWidth = Math.max(...lineCalculations, 0);
    naturalWidth = maxLineWidth + padX * 2;
    contentHeight = Math.max(lines.length, 1) * (fontSize * 1.3) + padY * 2;
  } else {
    minContentWidth = Math.max(10, padX * 2);
    naturalWidth = padX * 2;
  }

  // No modo de quebra automática, o usuário define a largura nas alças (respeitando minContentWidth).
  // No modo manual, a largura abraça com exatidão matemática a linha mais longa (naturalWidth).
  const width = ann.autoWrap && ann.width !== undefined ? Math.max(minContentWidth, ann.width) : naturalWidth;

  // Altura final: se o usuário definiu height (e autoWrap), respeita a altura definida ou o conteúdo.
  // No modo manual, a altura deve abraçar rigorosamente o conteúdo (contentHeight).
  const height = ann.autoWrap && ann.height !== undefined ? Math.max(contentHeight, ann.height) : contentHeight;

  return {
    width,
    height,
    minWidth: minContentWidth,
    minHeight: contentHeight,
  };
}

function rotatePoint(
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
 * Verifica se um ponto (x, y) no espaço do canvas está contido dentro da área
 * delimitadora de uma anotação de texto (mesmo quando transparente ou rotacionada).
 */
export function isPointInsideTextAnnotation(
  point: { x: number; y: number },
  ann: any
): boolean {
  if (!ann || ann.type !== 'text') return false;

  const dims = calculateTextDimensions(ann);
  const w = dims.width;
  const h = dims.height;
  const ax = ann.x || 0;
  const ay = ann.y || 0;
  const rot = ann.rotation ?? 0;

  const cx = ax + w / 2;
  const cy = ay + h / 2;

  // Rotaciona o ponto de volta para o sistema alinhado com os eixos locais do texto
  const localPoint = rotatePoint(point, { x: cx, y: cy }, -rot);

  // Adiciona uma tolerância suave de 2px nas bordas para cliques confortáveis
  const tolerance = 2;
  return (
    localPoint.x >= ax - tolerance &&
    localPoint.x <= ax + w + tolerance &&
    localPoint.y >= ay - tolerance &&
    localPoint.y <= ay + h + tolerance
  );
}
/**
 * Determina se as 4 alças circulares de redimensionamento dos cantos devem ser exibidas.
 * Para anotações de texto, as alças só são exibidas quando a quebra automática estiver ativada (autoWrap: true).
 * Para outras formas (retângulo, elipse, redação), as alças são sempre visíveis.
 */
export function shouldShowTextCornerAnchors(ann: { type: string; autoWrap?: boolean }): boolean {
  if (ann.type !== 'text') return true;
  return Boolean(ann.autoWrap);
}

/**
 * Retorna os atributos para resetar o bloco de texto para o tamanho automático natural (auto-fit).
 */
export function resetTextDimensionsToAutoFit(): { width: undefined; height: undefined; autoWrap: false } {
  return {
    width: undefined,
    height: undefined,
    autoWrap: false,
  };
}

/**
 * Posiciona o cursor de edição (caret) no final do conteúdo de um elemento contentEditable
 * (sempre à frente da última palavra / letra).
 */
export function placeCaretAtEnd(el: HTMLElement): void {
  if (typeof el.focus === 'function') {
    el.focus();
  }
  const sel = typeof window !== 'undefined' && typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (!sel) return;

  function findLastTextNode(node: Node): Node | null {
    if (node.nodeType === 3 && typeof node.nodeValue === 'string' && node.nodeValue.length > 0) {
      return node;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        const found = findLastTextNode(node.childNodes[i]);
        if (found) return found;
      }
    }
    return null;
  }

  const lastTextNode = findLastTextNode(el);
  if (typeof document !== 'undefined' && typeof document.createRange === 'function') {
    const range = document.createRange();
    if (lastTextNode && typeof lastTextNode.nodeValue === 'string') {
      range.setStart(lastTextNode, lastTextNode.nodeValue.length);
      range.setEnd(lastTextNode, lastTextNode.nodeValue.length);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }

    sel.removeAllRanges();
    sel.addRange(range);
  }
}

