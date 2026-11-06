import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CAPTURE_SHORTCUT_EVENT, listenForCaptureShortcut } from '../src/services/shortcutService';

describe('shortcutService', () => {
  it('uses the same event name as the Rust side (shortcuts.rs)', () => {
    const rust = fs.readFileSync(path.resolve(__dirname, '../src-tauri/src/shortcuts.rs'), 'utf-8');
    const match = rust.match(/CAPTURE_SHORTCUT_EVENT: &str = "([^"]+)"/);
    expect(match?.[1]).toBe(CAPTURE_SHORTCUT_EVENT);
  });

  it('subscribes to the capture shortcut event and triggers the callback', async () => {
    let registered: (() => void) | undefined;
    const listen = vi.fn(async (_event: string, handler: () => void) => {
      registered = handler;
      return () => {};
    });
    const onTrigger = vi.fn();

    await listenForCaptureShortcut(onTrigger, { isTauri: true, listen });

    expect(listen).toHaveBeenCalledWith(CAPTURE_SHORTCUT_EVENT, expect.any(Function));
    registered?.();
    registered?.();
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it('returns an unsubscribe function that calls the underlying unlisten', async () => {
    const unlisten = vi.fn();
    const stop = await listenForCaptureShortcut(() => {}, { isTauri: true, listen: async () => unlisten });
    stop();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside Tauri (browser mode)', async () => {
    const listen = vi.fn(async () => () => {});
    const stop = await listenForCaptureShortcut(() => {}, { isTauri: false, listen });
    expect(listen).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('survives a failing listen and returns a no-op unsubscribe', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stop = await listenForCaptureShortcut(() => {}, {
      isTauri: true,
      listen: async () => {
        throw new Error('not allowed');
      },
    });
    expect(() => stop()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
