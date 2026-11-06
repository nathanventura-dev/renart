import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { captureTitle } from '../src/utils/captureTitle';
import { describeCaptureError } from '../src/services/captureService';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');

describe('captureTitle', () => {
  it('names region and full screen captures after the current gallery size', () => {
    expect(captureTitle('region', 0)).toBe('Captura #1');
    expect(captureTitle('fullscreen', 4)).toBe('Tela Inteira #5');
    expect(captureTitle('window', 2)).toBe('Janela #3');
  });
});

describe('describeCaptureError', () => {
  it('explains how to grant the Screen Recording permission', () => {
    const expected = 'Gravação de Tela';
    expect(describeCaptureError(new Error('screen-recording-denied'))).toContain(expected);
    expect(describeCaptureError('screen-recording-denied')).toContain(expected);
  });

  it('falls back to a generic message for any other error', () => {
    expect(describeCaptureError(new Error('boom'))).toBe('Não foi possível iniciar a captura.');
    expect(describeCaptureError(undefined)).toBe('Não foi possível iniciar a captura.');
  });
});

describe('App multi-monitor wiring', () => {
  it('uses the native multi-monitor capture inside Tauri and adds the result to the gallery', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('beginCapture');
    expect(app).toContain('onCaptureComplete');
    expect(app).toContain('describeCaptureError');
    expect(app).toContain('captureTitle(kind');
  });

  it('sends the window mode to the native capture too (and keeps the in-app path for the browser)', () => {
    const app = read('src/App.tsx');
    expect(app).toMatch(/isTauri\(\) && \(mode === 'region' \|\| mode === 'fullscreen' \|\| mode === 'window'\)/);
  });

  it('keeps the in-app overlay as the browser fallback', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('setIsCapturing(true)');
    expect(app).toContain('captureDesktopFrame');
  });
});
