import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Toolbar } from '../src/components/Toolbar';

describe('Toolbar Advanced Text Controls UI', () => {
  it('renders typography, style toggles, alignment buttons, and highlight toggle in text submenu', () => {
    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'text',
        initialOpenMenu: 'text',
        fontFamily: 'Arial',
        fontSize: 18,
        isBold: true,
        isItalic: false,
        isUnderline: true,
        isStrikethrough: false,
        textAlign: 'center',
        hasBackground: true,
        autoWrap: true,
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

    // Tipografia
    expect(html).toContain('title="Família da fonte"');
    expect(html).toContain('title="Tamanho da fonte"');

    // Estilo (Bold, Italic, Underline, Strikethrough)
    expect(html).toContain('title="Negrito (Ctrl+B)"');
    expect(html).toContain('title="Itálico (Ctrl+I)"');
    expect(html).toContain('title="Sublinhado (Ctrl+U)"');
    expect(html).toContain('title="Tachado / Riscado"');

    // Alinhamento (Left, Center, Right)
    expect(html).toContain('title="Alinhar à esquerda"');
    expect(html).toContain('title="Centralizar"');
    expect(html).toContain('title="Alinhar à direita"');

    // Fundo / Destaque
    expect(html).toContain('title="Caixa de destaque / Fundo do texto"');
    expect(html).toContain('title="Quebra automática de linha (Auto-wrap)"');

    // Verifica destaques ativos (#0071e3)
    // Negrito está ativo
    expect(html).toContain('title="Negrito (Ctrl+B)" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');
    // Centralizar está ativo
    expect(html).toContain('title="Centralizar" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');
    // Fundo está ativo
    expect(html).toContain('title="Caixa de destaque / Fundo do texto" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');
  });
});
