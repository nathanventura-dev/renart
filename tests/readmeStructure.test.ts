import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('README.md Structure', () => {
  it('contains the RenArt flagship header, mascots, features and cli documentation', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');

    // Header dinâmico com mascote
    expect(content).toContain('docs/assets/renart-mascot-dark.jpg');
    expect(content).toContain('docs/assets/renart-mascot-light.jpg');
    expect(content).toContain('prefers-color-scheme: dark');

    // Nomes oficiais
    expect(content).toContain('RenArt');
    expect(content).toContain('vulcap');

    // Diferenciais fundamentais
    expect(content).toContain('Lupa Cirúrgica com Coroa Giratória');
    expect(content).toContain('Smart Text');
    expect(content).toContain('Alt + Click');

    // Clarificação da CLI vulcap vinculada ao roadmap da Fase 3
    expect(content).toContain('Fase 3');
    expect(content).toContain('especificação');

    // Link para documentação técnica em docs/
    expect(content).toContain('docs/README.md');

    // Stack e Guia de Execução
    expect(content).toContain('npm run dev');
    expect(content).toContain('vitest');
  });

  it('has a valid LICENSE file in repository root', () => {
    const licensePath = path.resolve(__dirname, '../LICENSE');
    expect(fs.existsSync(licensePath)).toBe(true);
    const content = fs.readFileSync(licensePath, 'utf-8');
    expect(content).toContain('MIT License');
    expect(content).toContain('RenArt');
  });
});
