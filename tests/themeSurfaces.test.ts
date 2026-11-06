import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN = [
  '#ffffff', '#e5e5e7', '#86868b', '#f8fafc', '#475569', '#334155',
  '#e2e8f0', '#f5f5f7', '#f1f5f9', '#d1d1d6', '#1e293b', '#cbd5e1',
];

/** Linhas com cores de superfície literais, ignorando as marcadas com `theme-exempt`. */
function findLiteralSurfaceColors(relativePath: string): string[] {
  const content = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf-8');
  return content
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !line.includes('theme-exempt'))
    .filter(({ line }) => FORBIDDEN.some((c) => line.toLowerCase().includes(c)))
    .map(({ line, n }) => `${relativePath}:${n}: ${line.trim()}`);
}

describe('theme surfaces', () => {
  it('Toolbar.tsx has no literal surface colors', () => {
    expect(findLiteralSurfaceColors('src/components/Toolbar.tsx')).toEqual([]);
  });

  it('Toolbar.tsx exposes a theme toggle', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/components/Toolbar.tsx'), 'utf-8');
    expect(content).toContain('data-testid="theme-toggle"');
    expect(content).toContain('cyclePreference');
  });
});
