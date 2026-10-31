import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Toolbar } from '../src/components/Toolbar';
import { RedactionAnnotation } from '../src/state/editorStore';

describe('Toolbar Smart Text UI', () => {
  it('renders Texto Inteligente mode button in redaction menu', () => {
    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'redaction',
        initialOpenMenu: 'redaction',
        redactionLevel: 4,
        redactionMode: 'smart-text',
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

    expect(html).toContain('Texto Inteligente');
    expect(html).toContain('Substitui texto sensível por dados fictícios');
    // Button is highlighted when smart-text is active
    expect(html).toContain('background-color:#0071e3;color:#ffffff');
  });

  it('renders Sortear button when a smart-text redaction annotation is selected', () => {
    const selectedSmartText: RedactionAnnotation = {
      id: 'smart-1',
      type: 'redaction',
      mode: 'smart-text',
      x: 10,
      y: 10,
      width: 100,
      height: 30,
      bgColor: '#ffffff',
      textColor: '#000000',
    };

    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'select',
        initialOpenMenu: 'redaction',
        selectedAnnotations: [selectedSmartText],
        redactionLevel: 4,
        redactionMode: 'smart-text',
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

    expect(html).toContain('Sortear');
    expect(html).toContain('Gera novos dados fictícios para este bloco');
  });
});
