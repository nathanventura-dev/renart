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

  it('GallerySidebar.tsx has no literal surface colors', () => {
    expect(findLiteralSurfaceColors('src/components/GallerySidebar.tsx')).toEqual([]);
  });

  it('App.tsx has no literal surface colors', () => {
    expect(findLiteralSurfaceColors('src/App.tsx')).toEqual([]);
  });

  it('index.html defines dark startup colors', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain("html[data-theme='dark']");
    expect(html).toContain('#121211');
  });

  it('CanvasEditor workspace background comes from the palette', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/components/CanvasEditor.tsx'), 'utf-8');
    expect(content).toContain('backgroundColor: palette.workspace');
    expect(content).not.toContain("backgroundColor: '#e5e5e7'");
  });

  it('exportService does not depend on the theme', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/services/exportService.ts'), 'utf-8');
    expect(content.toLowerCase()).not.toContain('theme');
  });

  it('index.html makes buttons and selects inherit the themed text color', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toMatch(/button,\s*select,\s*input,\s*textarea\s*\{[^}]*color:\s*inherit/);
    expect(html).toContain('color-scheme');
  });

  it('Toolbar and GallerySidebar take the orange from the palette, not from RENART_THEME', () => {
    for (const f of ['src/components/Toolbar.tsx', 'src/components/GallerySidebar.tsx']) {
      const content = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf-8');
      expect(content).not.toContain('RENART_THEME');
    }
  });

  it('text over the orange in Toolbar uses palette.onPrimary instead of literal white', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../src/components/Toolbar.tsx'), 'utf-8');
    expect(content).not.toMatch(/\? '#ffffff' : palette\.icon/);
  });
});
