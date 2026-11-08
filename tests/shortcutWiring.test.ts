import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf-8');

describe('global capture shortcut wiring', () => {
  it('the shortcut and the tray start the capture in Rust, so the App no longer listens to a shortcut event', () => {
    const app = read('src/App.tsx');
    for (const gone of ['shortcutService', 'listenForCaptureShortcut', 'handleStartCaptureRef', 'isCapturingRef']) {
      expect(app, gone).not.toContain(gone);
    }
    expect(fs.existsSync(path.resolve(__dirname, '../src/services/shortcutService.ts'))).toBe(false);
  });

  it('App shows the notice when a capture started by the tray or the shortcut fails', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('onCaptureError');
    expect(app).toMatch(/onCaptureError\(\(message\) => \{?\s*setCaptureNotice\(describeCaptureError\(message\)\)/);
  });

  it('Tauri capability lets the main window listen to events', () => {
    const cap = JSON.parse(read('src-tauri/capabilities/default.json'));
    expect(cap.windows).toContain('main');
    expect(cap.permissions).toContain('core:default');
  });
});
