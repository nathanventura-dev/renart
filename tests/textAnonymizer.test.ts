import { describe, it, expect } from 'vitest';
import {
  classifyTokenType,
  anonymizeWord,
  anonymizeOcrLines,
  OcrLine,
} from '../src/utils/textAnonymizer';

describe('Contextual Synthetic Text Anonymizer', () => {
  describe('classifyTokenType', () => {
    it('classifies currency values correctly', () => {
      expect(classifyTokenType('R$1.500,00')).toBe('currency');
      expect(classifyTokenType('R$ 450,90')).toBe('currency');
      expect(classifyTokenType('$50.00')).toBe('currency');
      expect(classifyTokenType('€120')).toBe('currency');
    });

    it('classifies dates correctly', () => {
      expect(classifyTokenType('15/08/2024')).toBe('date');
      expect(classifyTokenType('2024-10-31')).toBe('date');
      expect(classifyTokenType('01.02.2023')).toBe('date');
    });

    it('classifies emails correctly', () => {
      expect(classifyTokenType('contato@empresa.com.br')).toBe('email');
      expect(classifyTokenType('user.test+dev@corp.io')).toBe('email');
    });

    it('classifies numeric sequences and document masks correctly', () => {
      expect(classifyTokenType('123.456.789-00')).toBe('digits');
      expect(classifyTokenType('(11)98765-4321')).toBe('digits');
      expect(classifyTokenType('987654321')).toBe('digits');
    });

    it('classifies general words correctly', () => {
      expect(classifyTokenType('Relatório')).toBe('word');
      expect(classifyTokenType('FATURAMENTO')).toBe('word');
      expect(classifyTokenType('desenvolvimento')).toBe('word');
    });
  });

  describe('anonymizeWord', () => {
    it('generates synthetic currency with similar format and length', () => {
      const original = 'R$ 1.500,00';
      const anon = anonymizeWord(original);
      expect(anon).toMatch(/^R\$\s?[0-9]{1,3}\.[0-9]{3},[0-9]{2}$/);
      expect(anon).not.toBe(original);
    });

    it('generates synthetic dates preserving delimiter', () => {
      const originalSlash = '15/08/2024';
      const anonSlash = anonymizeWord(originalSlash);
      expect(anonSlash).toMatch(/^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/);
      expect(anonSlash).not.toBe(originalSlash);

      const originalDash = '2024-10-31';
      const anonDash = anonymizeWord(originalDash);
      expect(anonDash).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
      expect(anonDash).not.toBe(originalDash);
    });

    it('generates synthetic emails with similar length', () => {
      const original = 'carlos@empresa.com';
      const anon = anonymizeWord(original);
      expect(anon).toContain('@');
      expect(anon.endsWith('.com') || anon.endsWith('.net') || anon.endsWith('.org')).toBe(true);
      expect(anon).not.toBe(original);
    });

    it('generates synthetic digits preserving masks', () => {
      const cpf = '123.456.789-00';
      const anonCpf = anonymizeWord(cpf);
      expect(anonCpf).toMatch(/^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$/);
      expect(anonCpf).not.toBe(cpf);
    });

    it('preserves casing in synthetic words', () => {
      // Uppercase
      const upper = anonymizeWord('RELATÓRIO');
      expect(upper).toBe(upper.toUpperCase());
      expect(upper).not.toBe('RELATÓRIO');

      // Titlecase
      const title = anonymizeWord('Faturamento');
      expect(title[0]).toBe(title[0].toUpperCase());
      expect(title.slice(1)).toBe(title.slice(1).toLowerCase());
      expect(title).not.toBe('Faturamento');

      // Lowercase
      const lower = anonymizeWord('empresa');
      expect(lower).toBe(lower.toLowerCase());
      expect(lower).not.toBe('empresa');
    });

    it('generates varied random words across multiple invocations', () => {
      const results = new Set(Array.from({ length: 10 }, () => anonymizeWord('financeiro')));
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('anonymizeOcrLines', () => {
    it('anonymizes a collection of OCR lines while maintaining coordinate structure', () => {
      const sampleLines: OcrLine[] = [
        {
          text: 'Faturamento Anual R$ 120.000,00',
          x: 10,
          y: 20,
          width: 300,
          height: 24,
          words: [
            { text: 'Faturamento', x: 10, y: 20, width: 80, height: 24 },
            { text: 'Anual', x: 95, y: 20, width: 45, height: 24 },
            { text: 'R$ 120.000,00', x: 145, y: 20, width: 100, height: 24 },
          ],
        },
      ];

      const anonLines = anonymizeOcrLines(sampleLines);
      expect(anonLines).toHaveLength(1);
      expect(anonLines[0].words).toHaveLength(3);
      expect(anonLines[0].words[0].replacementText).not.toBe('Faturamento');
      expect(anonLines[0].words[2].tokenType).toBe('currency');
      expect(anonLines[0].replacementText).toContain(anonLines[0].words[0].replacementText);
    });
  });
});
