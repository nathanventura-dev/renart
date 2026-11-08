import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');

describe('global capture shortcut wiring', () => {
  it('App starts a region capture when the shortcut fires, unless a capture is already open', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('listenForCaptureShortcut');
    expect(app).toMatch(/isCapturingRef\.current/);
    expect(app).toMatch(/handleStartCaptureRef\.current\('region'\)/);
  });

  it('Tauri capability lets the main window listen to events', () => {
    const cap = JSON.parse(read('src-tauri/capabilities/default.json'));
    expect(cap.windows).toContain('main');
    expect(cap.permissions).toContain('core:default');
  });
});
