import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { resolveWindowHighlight } from '../src/components/WindowPicker';
import { CaptureModeBar } from '../src/components/CaptureModeBar';
import type { HoverWindow } from '../src/services/captureService';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');

const hover: HoverWindow = {
  id: 9,
  appName: 'Safari',
  title: 'Documentação',
  rects: [
    { monitorId: 1, x: 900, y: 100, width: 100, height: 200 },
    { monitorId: 2, x: 0, y: 100, width: 200, height: 200 },
  ],
};

describe('resolveWindowHighlight', () => {
  it('returns nothing when there is no window under the cursor', () => {
    expect(resolveWindowHighlight(null, 1)).toBeNull();
    expect(resolveWindowHighlight({ id: null, appName: '', title: '', rects: [] }, 1)).toBeNull();
  });

  it('returns nothing for a monitor the window does not touch', () => {
    expect(resolveWindowHighlight(hover, 3)).toBeNull();
  });

  it('returns the local rectangle of this monitor and the "App — título" label', () => {
    expect(resolveWindowHighlight(hover, 2)).toEqual({
      rect: { x: 0, y: 100, width: 200, height: 200 },
      label: 'Safari — Documentação',
    });
    expect(resolveWindowHighlight(hover, 1)?.rect).toEqual({ x: 900, y: 100, width: 100, height: 200 });
  });

  it('labels with only the app name when the window has no title', () => {
    expect(resolveWindowHighlight({ ...hover, title: '' }, 1)?.label).toBe('Safari');
  });
});

describe('WindowPicker', () => {
  it('cancels on Escape and only picks when there is a window under the cursor', () => {
    const src = read('src/components/WindowPicker.tsx');
    expect(src).toContain("'Escape'");
    expect(src).toMatch(/hover\??\.id/);
    expect(src).toContain('onPick(');
  });
});

describe('CaptureModeBar', () => {
  it('is one shared bar with the three modes and no "Em breve"', () => {
    const html = renderToString(
      React.createElement(CaptureModeBar, { mode: 'window', onSwitchMode: () => {}, onCancel: () => {} })
    );
    for (const text of ['Área', 'Janela', 'Tela Inteira', 'Cancelar']) expect(html).toContain(text);
    expect(html).not.toContain('Em breve');
    expect(html).not.toContain('disabled');
    expect(html).toContain('data-capture-ui');
  });

  it('keeps the normal cursor on the bar (the overlay root has a crosshair)', () => {
    expect(read('src/components/CaptureModeBar.tsx')).toContain("cursor: 'default'");
  });

  it('is used by the three overlays', () => {
    for (const f of ['CaptureOverlay', 'ScreenPicker', 'WindowPicker']) {
      expect(read(`src/components/${f}.tsx`)).toContain('CaptureModeBar');
    }
  });
});

describe('OverlayApp window mode', () => {
  it('renders the WindowPicker, listens to the hover event and captures the clicked window', () => {
    const src = read('src/components/OverlayApp.tsx');
    expect(src).toContain('WindowPicker');
    expect(src).toContain('onHoverWindowChanged');
    expect(src).toMatch(/kind: 'window'/);
  });
});
