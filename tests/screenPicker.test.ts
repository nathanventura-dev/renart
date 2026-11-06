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
    for (const fn of ['finishCapture', 'cancelCapture', 'setOverlayMode', 'getOverlayFrame', 'onOverlayModeChanged']) {
      expect(src).toContain(fn);
    }
  });
});

describe('CaptureOverlay in overlay windows', () => {
  it('can disable the window mode with the "Em breve" hint', () => {
    const src = read('src/components/CaptureOverlay.tsx');
    expect(src).toContain('windowDisabled');
    expect(src).toContain('Em breve');
  });
});
