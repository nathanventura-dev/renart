// tests/toolbarRedactionLevels.test.ts
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  Toolbar,
  resolveRedactionToolbarState,
} from '../src/components/Toolbar';

describe('Toolbar Redaction Levels UI', () => {
  it('resolves effectiveRedactionLevel from selected annotation or defaults', () => {
    const selected = [{ id: '1', type: 'redaction', level: 2, mode: 'rect' } as any];
    const state = resolveRedactionToolbarState('select', selected, 4, 'rect');
    expect(state.effectiveRedactionLevel).toBe(2);

    const defaultState = resolveRedactionToolbarState('redaction', [], 4, 'rect');
    expect(defaultState.effectiveRedactionLevel).toBe(4);

    // Fallback for legacy effect
    const legacyState = resolveRedactionToolbarState(
      'select',
      [{ id: '2', type: 'redaction', effect: 'blur', mode: 'rect' } as any],
      4,
      'rect'
    );
    expect(legacyState.effectiveRedactionLevel).toBe(3);

    // Each level defaults when no redaction selected
    expect(resolveRedactionToolbarState('redaction', [], 1, 'rect').effectiveRedactionLevel).toBe(1);
    expect(resolveRedactionToolbarState('redaction', [], 2, 'rect').effectiveRedactionLevel).toBe(2);
    expect(resolveRedactionToolbarState('redaction', [], 3, 'rect').effectiveRedactionLevel).toBe(3);
    expect(resolveRedactionToolbarState('redaction', [], 4, 'rect').effectiveRedactionLevel).toBe(4);
  });

  it('renders EyeOff main tool button and 4 level buttons in submenu', () => {
    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'redaction',
        initialOpenMenu: 'redaction',
        redactionLevel: 3,
        redactionMode: 'rect',
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

    // Main button tooltip
    expect(html).toContain('Ocultar informações');

    // 4 Level button titles/tooltips
    expect(html).toContain('Nível 1: Desfoque suave');
    expect(html).toContain('Nível 2: Desfoque moderado');
    expect(html).toContain('Nível 3: Desfoque total sem visibilidade');
    expect(html).toContain('Nível 4: Tarja preta 100% sólida');

    // Mode buttons
    expect(html).toContain('Retângulo');
    expect(html).toContain('Pincel');
  });

  it('highlights the correct level button depending on active level', () => {
    const renderForLevel = (lvl: 1 | 2 | 3 | 4) =>
      renderToString(
        React.createElement(Toolbar, {
          activeTool: 'redaction',
          initialOpenMenu: 'redaction',
          redactionLevel: lvl,
          redactionMode: 'rect',
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

    const html1 = renderForLevel(1);
    expect(html1).toContain('title="Nível 1: Desfoque suave para rostos e fundos" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');

    const html2 = renderForLevel(2);
    expect(html2).toContain('title="Nível 2: Desfoque moderado para texto" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');

    const html3 = renderForLevel(3);
    expect(html3).toContain('title="Nível 3: Desfoque total sem visibilidade" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');

    const html4 = renderForLevel(4);
    expect(html4).toContain('title="Nível 4: Tarja preta 100% sólida (Inviolável)" style="width:28px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:4px;cursor:pointer;background-color:#0071e3;color:#ffffff"');
  });
});
