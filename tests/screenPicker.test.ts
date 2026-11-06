import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePickerState } from '../src/components/ScreenPicker';
import { toCaptureSelection } from '../src/components/OverlayApp';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');

describe('ScreenPicker', () => {
  it('dims the screen until the mouse is over it, then shows the camera and the hint', () => {
    expect(resolvePickerState(false)).toEqual({ dimmed: true, showCamera: false, hint: '' });
    expect(resolvePickerState(true)).toEqual({
      dimmed: false,
      showCamera: true,
      hint: 'Clique para capturar esta tela',
    });
  });

  it('shows the camera only when the Rust cursor tracker says this monitor is active', () => {
    const src = read('src/components/ScreenPicker.tsx');
    expect(src).toMatch(/active: boolean/);
    expect(src).toMatch(/resolvePickerState\(active\)/);
    // janela sem foco não recebe mouseleave: o hover local deixava a câmera presa no monitor anterior
    expect(src).not.toContain('hovered');
    expect(src).not.toContain('onMouseEnter');
  });

  it('uses the Camera icon and cancels on Escape', () => {
    const src = read('src/components/ScreenPicker.tsx');
    expect(src).toMatch(/import \{[^}]*\bCamera\b[^}]*\} from 'lucide-react'/);
    expect(src).toContain("'Escape'");
  });
});

describe('OverlayApp', () => {
  it('converts the overlay result into the selection sent to Rust', () => {
    expect(toCaptureSelection('fullscreen')).toEqual({ kind: 'fullscreen' });
    expect(toCaptureSelection({ x: 10, y: 20, width: 30, height: 40 })).toEqual({
      kind: 'region',
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
    expect(toCaptureSelection({ freeformPoints: [{ x: 1, y: 1 }] })).toBeNull();
  });

  it('finishes, cancels and switches modes through the capture service', () => {
    const src = read('src/components/OverlayApp.tsx');
    for (const fn of ['finishCapture', 'cancelCapture', 'setOverlayMode', 'getOverlayFrame', 'onOverlayModeChanged', 'overlayReady', 'onActiveMonitorChanged']) {
      expect(src).toContain(fn);
    }
  });
});

describe('options bar cursor', () => {
  it('the options bar resets the inherited crosshair to the normal cursor', () => {
    const src = read('src/components/CaptureModeBar.tsx');
    const start = src.indexOf('data-capture-ui');
    const barStyle = src.slice(start, src.indexOf('}}', start));
    expect(barStyle).toContain("cursor: 'default'");
  });

  it('marks the options bar so OverlayApp can report its rectangle to Rust', () => {
    expect(read('src/components/CaptureModeBar.tsx')).toContain('data-capture-ui');
    const app = read('src/components/OverlayApp.tsx');
    expect(app).toContain('setOverlayUiRect');
    expect(app).toContain('getBoundingClientRect');
    expect(app).toContain('[data-capture-ui]');
  });
});

describe('OverlayApp frame loading', () => {
  it('decodes the frame before telling Rust to show the window (no black flash)', () => {
    const src = read('src/components/OverlayApp.tsx');
    expect(src).toContain('.decode()');
    expect(src.indexOf('.decode()')).toBeLessThan(src.indexOf('overlayReady('));
    expect(src).toContain('revokeObjectURL');
  });
});

describe('CaptureOverlay in overlay windows', () => {
  it('no longer disables the window mode', () => {
    const src = read('src/components/CaptureOverlay.tsx');
    expect(src).not.toContain('windowDisabled');
    expect(src).not.toContain('Em breve');
  });
});
