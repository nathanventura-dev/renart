import { describe, it, expect } from 'vitest';
import {
  resolveKonvaFontStyle,
  resolveKonvaTextDecoration,
  resolveTextCssStyle,
  parseHtmlToSpans,
  spansToHtml,
  splitSpansIntoLines,
  wrapSpansToWidth,
  calculateTextDimensions,
  measureSpanWidth,
} from '../src/utils/textStyle';

describe('Text Styling Helpers', () => {
  describe('resolveKonvaFontStyle', () => {
    it('returns normal when neither bold nor italic is active', () => {
      expect(resolveKonvaFontStyle(false, false)).toBe('normal');
      expect(resolveKonvaFontStyle(undefined, undefined)).toBe('normal');
    });

    it('returns bold when only bold is active', () => {
      expect(resolveKonvaFontStyle(true, false)).toBe('bold');
      expect(resolveKonvaFontStyle(true, undefined)).toBe('bold');
    });

    it('returns italic when only italic is active', () => {
      expect(resolveKonvaFontStyle(false, true)).toBe('italic');
      expect(resolveKonvaFontStyle(undefined, true)).toBe('italic');
    });

    it('returns italic bold when both bold and italic are active', () => {
      expect(resolveKonvaFontStyle(true, true)).toBe('italic bold');
    });
  });

  describe('resolveKonvaTextDecoration', () => {
    it('returns empty string when neither underline nor strikethrough is active', () => {
      expect(resolveKonvaTextDecoration(false, false)).toBe('');
      expect(resolveKonvaTextDecoration(undefined, undefined)).toBe('');
    });

    it('returns underline when only underline is active', () => {
      expect(resolveKonvaTextDecoration(true, false)).toBe('underline');
    });

    it('returns line-through when only strikethrough is active', () => {
      expect(resolveKonvaTextDecoration(false, true)).toBe('line-through');
    });

    it('returns underline line-through when both are active', () => {
      expect(resolveKonvaTextDecoration(true, true)).toBe('underline line-through');
    });
  });

  describe('resolveTextCssStyle', () => {
    it('generates correct CSS properties for textarea inline editing', () => {
      const normal = resolveTextCssStyle(false, false, false, false);
      expect(normal).toEqual({
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
      });

      const full = resolveTextCssStyle(true, true, true, true);
      expect(full).toEqual({
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecoration: 'underline line-through',
      });

      const underlineOnly = resolveTextCssStyle(false, false, true, false);
      expect(underlineOnly.textDecoration).toBe('underline');

      const strikethroughOnly = resolveTextCssStyle(false, false, false, true);
      expect(strikethroughOnly.textDecoration).toBe('line-through');
    });
  });

  describe('Rich Text Spans and HTML Converters', () => {
    it('parseHtmlToSpans returns plain text when no formatting tags are present', () => {
      const res = parseHtmlToSpans('Texto simples sem tags');
      expect(res.text).toBe('Texto simples sem tags');
      expect(res.spans).toBeUndefined();
    });

    it('parseHtmlToSpans extracts styled spans when part of text is bolded', () => {
      const html = 'Texto <b>importante</b> aqui';
      const res = parseHtmlToSpans(html);
      expect(res.text).toBe('Texto importante aqui');
      expect(res.spans).toBeDefined();
      expect(res.spans?.length).toBe(3);
      expect(res.spans?.[0]).toMatchObject({ text: 'Texto ' });
      expect(res.spans?.[1]).toMatchObject({ text: 'importante', isBold: true });
      expect(res.spans?.[2]).toMatchObject({ text: ' aqui' });
    });

    it('parseHtmlToSpans handles nested styles and strikethrough / underline tags', () => {
      const html = '<u>Sub</u> e <s>riscado</s> e <b><i>ambos</i></b>';
      const res = parseHtmlToSpans(html);
      expect(res.text).toBe('Sub e riscado e ambos');
      expect(res.spans).toBeDefined();
      const boldItalicSpan = res.spans?.find((s) => s.text === 'ambos');
      expect(boldItalicSpan?.isBold).toBe(true);
      expect(boldItalicSpan?.isItalic).toBe(true);

      const underSpan = res.spans?.find((s) => s.text === 'Sub');
      expect(underSpan?.isUnderline).toBe(true);

      const strikeSpan = res.spans?.find((s) => s.text === 'riscado');
      expect(strikeSpan?.isStrikethrough).toBe(true);
    });

    it('parseHtmlToSpans correctly converts line breaks (<br> and <div>)', () => {
      const html = 'Linha 1<br>Linha 2';
      const res = parseHtmlToSpans(html);
      expect(res.text).toBe('Linha 1\nLinha 2');
    });

    it('spansToHtml converts styled spans back to HTML with formatting tags', () => {
      const spans = [
        { text: 'Normal ' },
        { text: 'Negrito', isBold: true },
        { text: ' Itálico', isItalic: true },
      ];
      const html = spansToHtml('Normal Negrito Itálico', spans);
      expect(html).toContain('<b>Negrito</b>');
      expect(html).toContain('<i> Itálico</i>');
    });

    it('splitSpansIntoLines breaks spans containing newlines across line arrays', () => {
      const spans = [
        { text: 'Primeira linha\nSegunda linha', isBold: true },
      ];
      const lines = splitSpansIntoLines(spans);
      expect(lines.length).toBe(2);
      expect(lines[0][0].text).toBe('Primeira linha');
      expect(lines[0][0].isBold).toBe(true);
      expect(lines[1][0].text).toBe('Segunda linha');
      expect(lines[1][0].isBold).toBe(true);
    });

    it('wraps spans into multiple lines when line width exceeds maxWidth', () => {
      const spans = [
        { text: 'Esta é uma frase bem longa para testar quebra automática de linha' },
      ];
      const wrapped = wrapSpansToWidth(spans, 150, 16, 'Arial');
      expect(wrapped.length).toBeGreaterThan(1);
      const reconstructed = wrapped.map((line) => line.map((s) => s.text).join('')).join(' ');
      expect(reconstructed).toContain('Esta é uma frase');
    });

    it('returns original lines when maxWidth is undefined or line fits within maxWidth', () => {
      const spans = [
        { text: 'Curto' },
      ];
      const wrapped = wrapSpansToWidth(spans, 500, 16, 'Arial');
      expect(wrapped.length).toBe(1);
      expect(wrapped[0][0].text).toBe('Curto');
    });
  });

  describe('calculateTextDimensions content-first sizing and height', () => {
    it('respects ann.height when greater than content height', () => {
      const ann = {
        text: 'Linha única',
        fontSize: 20,
        height: 150,
      };
      const dims = calculateTextDimensions(ann);
      expect(dims.height).toBe(150);
      expect(dims.minHeight).toBeLessThan(150);
    });

    it('clamps height up to content height when ann.height is smaller than text (never cuts text)', () => {
      const ann = {
        text: 'Primeira linha\nSegunda linha\nTerceira linha',
        fontSize: 20,
        height: 30, // Muito pequeno para 3 linhas de 20px
      };
      const dims = calculateTextDimensions(ann);
      // 3 linhas de 20px * 1.3 = 78px
      expect(dims.height).toBeGreaterThanOrEqual(75);
      expect(dims.height).toBe(dims.minHeight);
    });

    it('expands automatically when content exceeds previous fixed height', () => {
      const baseAnn = {
        text: 'Linha 1\nLinha 2',
        fontSize: 20,
        height: 60,
      };
      const baseDims = calculateTextDimensions(baseAnn);

      const expandedAnn = {
        text: 'Linha 1\nLinha 2\nLinha 3\nLinha 4\nLinha 5',
        fontSize: 20,
        height: 60, // Menor que 5 linhas
      };
      const expandedDims = calculateTextDimensions(expandedAnn);
      expect(expandedDims.height).toBeGreaterThan(baseDims.height);
      expect(expandedDims.height).toBeGreaterThan(60);
    });

    it('calculates minWidth strictly respecting the longest word', () => {
      const ann = {
        text: 'Uma palavraExtremamenteLongaQueNaoPodeQuebrar no texto',
        fontSize: 20,
        autoWrap: true,
        width: 40, // Usuário tentou encolher para 40px
      };
      const dims = calculateTextDimensions(ann);
      // Deve travar no minWidth da maior palavra e não em 40px
      expect(dims.minWidth).toBeGreaterThan(150);
      expect(dims.width).toBeGreaterThanOrEqual(dims.minWidth);
    });
    it('measures exact text width without artificial multiplier margin in manual mode', () => {
      const ann = {
        text: 'Teste',
        fontSize: 20,
        autoWrap: false,
        hasBackground: false,
      };
      const dims = calculateTextDimensions(ann);
      const expectedExact = measureSpanWidth('Teste', 20, 'Arial');
      expect(dims.width).toBe(expectedExact);
    });

    it('measures multi-line plain text width matching the widest line exactly', () => {
      const ann = {
        text: 'Curto\nLinha bem mais longa\nMedio',
        fontSize: 20,
        autoWrap: false,
        hasBackground: false,
      };
      const dims = calculateTextDimensions(ann);
      const expectedWidest = measureSpanWidth('Linha bem mais longa', 20, 'Arial');
      expect(dims.width).toBe(expectedWidest);
    });
  });
});