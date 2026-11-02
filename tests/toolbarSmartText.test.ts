import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Toolbar } from '../src/components/Toolbar';
import { RedactionAnnotation } from '../src/state/editorStore';

describe('Clean Redaction Toolbar UI', () => {
  it('renders only Retângulo and Pincel modes in redaction menu without smart-text', () => {
    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'redaction',
        initialOpenMenu: 'redaction',
        redactionLevel: 1,
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

    expect(html).toContain('Retângulo');
    expect(html).toContain('Pincel');
    // smart-text should NOT be present in the redaction menu
    expect(html).not.toContain('Texto Inteligente');
  });

  it('does not render Sortear button in toolbar', () => {
    const selectedRedact: RedactionAnnotation = {
      id: 'redact-1',
      type: 'redaction',
      mode: 'rect',
      x: 10,
      y: 10,
      width: 100,
      height: 30,
    };

    const html = renderToString(
      React.createElement(Toolbar, {
        activeTool: 'select',
        initialOpenMenu: null,
        selectedAnnotations: [selectedRedact],
        redactionLevel: 1,
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

    expect(html).not.toContain('Sortear');
  });
});
