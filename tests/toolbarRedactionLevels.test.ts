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
});
