// tests/toolbarMenus.test.ts
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Toolbar,
  resolveActiveToolbarMenu,
  OpenToolbarMenu,
  TOOLBAR_COLORS,
  isClickOutsideActiveMenu,
  shouldSwitchToolOnMenuClick,
  resolveRedactionToolbarState,
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

  it('correctly detects click outside active menu via isClickOutsideActiveMenu', () => {
    const fakePaletteNode = { contains: (target: any) => target === 'inside-palette' } as any;
    const containers = {
      palette: fakePaletteNode,
      arrow: null,
      magnifier: null,
      text: null,
    };

    // Alvo dentro da paleta -> não deve fechar
    expect(isClickOutsideActiveMenu('palette', containers, 'inside-palette' as any)).toBe(false);

    // Alvo fora da paleta (ex: canvas) -> deve fechar
    expect(isClickOutsideActiveMenu('palette', containers, 'outside-canvas' as any)).toBe(true);

    // Sem menu ativo -> não faz nada
    expect(isClickOutsideActiveMenu(null, containers, 'outside-canvas' as any)).toBe(false);
  });

  it('determines whether to switch active tool when opening submenu via shouldSwitchToolOnMenuClick', () => {
    // Se a ferramenta já está ativa, não deve chamar switch
    expect(shouldSwitchToolOnMenuClick('arrow', 'arrow', [])).toBe(false);

    // Se há uma anotação de flecha selecionada no canvas, não deve alternar/limpar seleção
    expect(
      shouldSwitchToolOnMenuClick('select', 'arrow', [
        { id: 'arr-1', type: 'arrow', points: [0, 0, 10, 10] },
      ])
    ).toBe(false);

    // Se é outra ferramenta e não há flecha selecionada, deve alternar a ferramenta
    expect(shouldSwitchToolOnMenuClick('select', 'arrow', [])).toBe(true);
  });

  it('renders minimalist translucent action buttons with keyboard shortcuts in a horizontal floating menu below crop icon', () => {
    const htmlCrop = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'crop',
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
        isCropping: true,
        onConfirmCrop: () => {},
        onCancelCrop: () => {},
      })
    );

    // Menu horizontal flutuante padronizado abaixo do ícone
    expect(htmlCrop).toContain('data-testid="horizontal-floating-menu-crop"');
    expect(htmlCrop).toContain('top:calc(100% + 6px)');

    expect(htmlCrop).toContain('Confirmar');
    expect(htmlCrop).toContain('Cancelar');
    // Atalhos visuais de teclado
    expect(htmlCrop).toContain('↵');
    expect(htmlCrop).toContain('esc');
    // Cores translúcidas elegantes em vez de cores sólidas saturadas
    expect(htmlCrop).toContain('rgba(34, 197, 94, 0.12)');
    expect(htmlCrop).toContain('rgba(239, 68, 68, 0.08)');
  });

  it('renders minimalist capture button and right-aligned capture dropdown menu with Area, Window, and Fullscreen', () => {
    // 1. Testa que resolveActiveToolbarMenu suporta 'capture'
    let activeMenu: OpenToolbarMenu = null;
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'capture');
    expect(activeMenu).toBe('capture');
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'capture');
    expect(activeMenu).toBeNull();

    // 2. Renderiza a Toolbar em estado fechado padrão (deve mostrar o texto "Nova Captura" com a câmera)
    const htmlClosed = renderToString(
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
      })
    );
    expect(htmlClosed).toContain('Nova Captura</span>');
    expect(htmlClosed).toContain('lucide-camera');

    // 3. Renderiza a Toolbar com o menu de captura aberto (initialOpenMenu: 'capture')
    let capturedMode = '';
    const htmlCapture = renderToString(
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
        onNewCapture: (mode) => {
          capturedMode = mode || 'region';
        },
        onCopy: () => {},
        onExport: () => {},
        onInsertImage: () => {},
        initialOpenMenu: 'capture',
      })
    );
    expect(capturedMode).toBe('');

    // Quando aberto: botão encolhe para apenas o ícone azul, sem o texto "Nova Captura</span>"
    expect(htmlCapture).not.toContain('Nova Captura</span>');
    expect(htmlCapture).toContain('title="Nova Captura"');
    expect(htmlCapture).toContain('lucide-camera');
    expect(htmlCapture).toContain('rgba(211, 85, 29, 0.12)');

    // Menu suspenso de captura à direita com as 3 opções
    expect(htmlCapture).toContain('Área');
    expect(htmlCapture).toContain('Janela');
    expect(htmlCapture).toContain('Tela Inteira');

    // Estilo consistente com o menu horizontal de exportação (#f8fafc e transition:all 0.15s ease)
    expect(htmlCapture).toContain('left:100%');
    expect(htmlCapture).toContain('transition:all 0.15s ease');
    expect(htmlCapture).toContain('color:#475569');
  });

  it('renders minimalist horizontal export menu to the left of the blue active export button with .png, .jpeg, .pdf', () => {
    // 1. resolveActiveToolbarMenu suporta 'export'
    let activeMenu: OpenToolbarMenu = null;
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'export');
    expect(activeMenu).toBe('export');
    activeMenu = resolveActiveToolbarMenu(activeMenu, 'export');
    expect(activeMenu).toBeNull();

    // 2. Renderiza a Toolbar com o menu de exportação aberto (initialOpenMenu: 'export')
    const htmlExport = renderToString(
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
        initialOpenMenu: 'export',
      })
    );

    // Botão de exportar fica com estilo azul ativo
    expect(htmlExport).toContain('rgba(211, 85, 29, 0.12)');
    expect(htmlExport).toContain('#d3551d');

    // Menu horizontal com opções minimalistas
    expect(htmlExport).toContain('.png');
    expect(htmlExport).toContain('.jpeg');
    expect(htmlExport).toContain('.pdf');

    // Não deve exibir o dropdown vertical antigo com min-width 140px
    expect(htmlExport).not.toContain('min-width:140px');
  });

  it('resolves redaction toolbar state and renders redaction menu controls in Toolbar', () => {
    // 1. Testa resolveRedactionToolbarState
    const activeState = resolveRedactionToolbarState('redaction', [], 'blackout', 'rect');
    expect(activeState.showRedactionControls).toBe(true);
    expect(activeState.effectiveRedactionEffect).toBe('blackout');
    expect(activeState.effectiveRedactionMode).toBe('rect');

    const selectedState = resolveRedactionToolbarState(
      'select',
      [{ id: 'r1', type: 'redaction', effect: 'blur', mode: 'brush' }],
      'blackout',
      'rect'
    );
    expect(selectedState.showRedactionControls).toBe(true);
    expect(selectedState.effectiveRedactionEffect).toBe('blur');
    expect(selectedState.effectiveRedactionMode).toBe('brush');

    // 2. Renderiza Toolbar com o menu de redaction aberto
    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'redaction',
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
        initialOpenMenu: 'redaction',
      })
    );

    // Deve conter os 3 níveis de privacidade (ícones com tooltips) e modos Retângulo e Pincel
    expect(html).toContain('Nível 1: Desfoque suave');
    expect(html).toContain('Nível 2: Desfoque moderado');
    expect(html).toContain('Nível 3: Tarja preta 100% sólida');
    expect(html).not.toContain('Desfoque total sem visibilidade');
    expect(html).toContain('Retângulo');
    expect(html).toContain('Pincel');
  });
});
