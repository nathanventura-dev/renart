// tests/toolbarMenus.test.ts
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Toolbar,
  resolveActiveToolbarMenu,
  OpenToolbarMenu,
  TOOLBAR_COLORS,
} from '../src/components/Toolbar';

describe('Toolbar Horizontal Menus & Palette Dropdown', () => {
  it('toggles menu state correctly with exclusivity and toggle behavior', () => {
    // 1. Inicialmente nenhum menu aberto
    let activeMenu: OpenToolbarMenu = null;

    // 2. Clicar na paleta abre a paleta
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'palette');
    expect(activeMenu).toBe('palette');

    // 3. Clicar novamente na paleta fecha (toggle)
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'palette');
    expect(activeMenu).toBeNull();

    // 4. Abrir paleta e depois clicar em flecha fecha a paleta e abre a flecha (exclusividade)
    activeMenu = resolveActiveToolbarMenu(null, 'palette');
    expect(activeMenu).toBe('palette');
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'arrow');
    expect(activeMenu).toBe('arrow');

    // 5. Clicar fora ou passar null reseta para null
    activeMenu = resolveActiveToolbarMenu(activeMenu, null);
    expect(activeMenu).toBeNull();
  });

  it('provides the standard 7 palette colors', () => {
    expect(TOOLBAR_COLORS).toHaveLength(7);
    expect(TOOLBAR_COLORS).toContain('#ff3b30'); // Vermelho
    expect(TOOLBAR_COLORS).toContain('#0071e3'); // Azul
    expect(TOOLBAR_COLORS).toContain('#ffffff'); // Branco
  });

  it('renders the palette trigger button with current active color', () => {
    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'select',
        onSelectTool: () => {},
        strokeColor: '#34c759',
        onSelectColor: () => {},
        strokeWidth: 2,
        onSelectStrokeWidth: () => {},
        canUndo: false,
        canRedo: false,
        onUndo: () => {},
        onRedo: () => {},
        onNewCapture: () => {},
        onCopy: () => {},
        onExport: () => {},
        onInsertImage: () => {},
      })
    );

    // O botão da paleta deve estar presente
    expect(html).toContain('data-testid="palette-trigger-button"');
    expect(html).toContain('title="Paleta de cores"');
  });

  it('renders palette colors inside horizontal floating menu when open', () => {
    const htmlOpen = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'select',
        onSelectTool: () => {},
        strokeColor: '#ff3b30',
        onSelectColor: () => {},
        strokeWidth: 2,
        onSelectStrokeWidth: () => {},
        canUndo: false,
        canRedo: false,
        onUndo: () => {},
        onRedo: () => {},
        onNewCapture: () => {},
        onCopy: () => {},
        onExport: () => {},
        onInsertImage: () => {},
        initialOpenMenu: 'palette',
      })
    );

    expect(htmlOpen).toContain('data-testid="horizontal-floating-menu-palette"');
    for (const color of TOOLBAR_COLORS) {
      expect(htmlOpen).toContain(`title="Cor ${color}"`);
    }
  });

  it('renders arrow styles and invert curve button inside horizontal floating menu', () => {
    const htmlArrow = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'arrow',
        onSelectTool: () => {},
        strokeColor: '#ff3b30',
        onSelectColor: () => {},
        strokeWidth: 2,
        onSelectStrokeWidth: () => {},
        canUndo: false,
        canRedo: false,
        onUndo: () => {},
        onRedo: () => {},
        onNewCapture: () => {},
        onCopy: () => {},
        onExport: () => {},
        onInsertImage: () => {},
        arrowStyle: 'curved',
        initialOpenMenu: 'arrow',
      })
    );

    expect(htmlArrow).toContain('data-testid="horizontal-floating-menu-arrow"');
    expect(htmlArrow).toContain('Padrão');
    expect(htmlArrow).toContain('Fina');
    expect(htmlArrow).toContain('Pontilhada');
    expect(htmlArrow).toContain('Curva');
    expect(htmlArrow).toContain('Inverter arco');
  });

  it('renders magnifier options (Sem foco / Com foco) inside horizontal floating menu', () => {
    const htmlMag = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'magnifier',
        onSelectTool: () => {},
        strokeColor: '#ff3b30',
        onSelectColor: () => {},
        strokeWidth: 2,
        onSelectStrokeWidth: () => {},
        canUndo: false,
        canRedo: false,
        onUndo: () => {},
        onRedo: () => {},
        onNewCapture: () => {},
        onCopy: () => {},
        onExport: () => {},
        onInsertImage: () => {},
        initialOpenMenu: 'magnifier',
      })
    );

    expect(htmlMag).toContain('data-testid="horizontal-floating-menu-magnifier"');
    expect(htmlMag).toContain('Sem foco');
    expect(htmlMag).toContain('Com foco');
  });

  it('renders font family and font size selects inside horizontal floating menu for text tool', () => {
    const htmlText = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'text',
        onSelectTool: () => {},
        strokeColor: '#ff3b30',
        onSelectColor: () => {},
        strokeWidth: 2,
        onSelectStrokeWidth: () => {},
        canUndo: false,
        canRedo: false,
        onUndo: () => {},
        onRedo: () => {},
        onNewCapture: () => {},
        onCopy: () => {},
        onExport: () => {},
        onInsertImage: () => {},
        initialOpenMenu: 'text',
      })
    );

    expect(htmlText).toContain('data-testid="horizontal-floating-menu-text"');
    expect(htmlText).toContain('title="Família da fonte"');
    expect(htmlText).toContain('title="Tamanho da fonte"');
  });
});
