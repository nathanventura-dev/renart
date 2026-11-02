import { describe, it, expect } from 'vitest';
import {
  resolveKonvaFontStyle,
  resolveKonvaTextDecoration,
  resolveTextCssStyle,
  parseHtmlToSpans,
  spansToHtml,
  splitSpansIntoLines,
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
  });
});
