import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  EVENT_CAPTURE_CANCELLED,
  EVENT_CAPTURE_COMPLETE,
  EVENT_OVERLAY_MODE,
  beginCapture,
  cancelCapture,
  finishCapture,
  getOverlayFrame,
  onCaptureCancelled,
  onCaptureComplete,
  onOverlayModeChanged,
  setOverlayMode,
} from '../src/services/captureService';

function fakeEnv() {
  const handlers: Record<string, (payload: unknown) => void> = {};
  return {
    handlers,
    invoke: vi.fn(async (_cmd: string, _args?: Record<string, unknown>) => 'ok' as unknown),
    listen: vi.fn(async (event: string, handler: (payload: never) => void) => {
      handlers[event] = handler as (payload: unknown) => void;
      return () => {};
    }),
  };
}

describe('captureService (Tauri)', () => {
  it('beginCapture invokes begin_capture with the mode', async () => {
    const env = fakeEnv();
    await beginCapture('region', { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('begin_capture', { mode: 'region' });
  });

  it('finishCapture invokes finish_capture with id and selection', async () => {
    const env = fakeEnv();
    const selection = { kind: 'region', x: 1, y: 2, width: 3, height: 4 } as const;
    await finishCapture(3, selection, { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('finish_capture', { id: 3, selection });
  });

  it('getOverlayFrame, cancelCapture and setOverlayMode call the matching commands', async () => {
    const env = fakeEnv();
    await getOverlayFrame(4, { ...env, isTauri: true });
    await cancelCapture({ ...env, isTauri: true });
    await setOverlayMode('fullscreen', { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('get_overlay_frame', { id: 4 });
    expect(env.invoke).toHaveBeenCalledWith('cancel_capture', undefined);
    expect(env.invoke).toHaveBeenCalledWith('set_overlay_mode', { mode: 'fullscreen' });
  });

  it('onCaptureComplete subscribes to capture-complete and forwards the payload', async () => {
    const env = fakeEnv();
    const cb = vi.fn();
    await onCaptureComplete(cb, { ...env, isTauri: true });
    env.handlers[EVENT_CAPTURE_COMPLETE]({ dataUrl: 'data:image/png;base64,AAA', fullscreen: true });
    expect(cb).toHaveBeenCalledWith({ dataUrl: 'data:image/png;base64,AAA', fullscreen: true });
  });

  it('onCaptureCancelled and onOverlayModeChanged subscribe to their events', async () => {
    const env = fakeEnv();
    const cancelled = vi.fn();
    const mode = vi.fn();
    await onCaptureCancelled(cancelled, { ...env, isTauri: true });
    await onOverlayModeChanged(mode, { ...env, isTauri: true });
    env.handlers[EVENT_CAPTURE_CANCELLED](null);
    env.handlers[EVENT_OVERLAY_MODE]('fullscreen');
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(mode).toHaveBeenCalledWith('fullscreen');
  });
});

describe('captureService (browser)', () => {
  it('rejects commands with capture-unavailable and never subscribes', async () => {
    const env = fakeEnv();
    await expect(beginCapture('region', { ...env, isTauri: false })).rejects.toThrow('capture-unavailable');
    await expect(cancelCapture({ ...env, isTauri: false })).rejects.toThrow('capture-unavailable');
    const stop = await onCaptureComplete(() => {}, { ...env, isTauri: false });
    expect(env.listen).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});

describe('contract with the Rust side', () => {
  it('event names and the denied error code match capture_session.rs', () => {
    const rust = fs.readFileSync(path.resolve(__dirname, '../src-tauri/src/capture_session.rs'), 'utf-8');
    const lit = (name: string) => rust.match(new RegExp(`${name}: &str = "([^"]+)"`))?.[1];
    expect(lit('EVENT_CAPTURE_COMPLETE')).toBe(EVENT_CAPTURE_COMPLETE);
    expect(lit('EVENT_CAPTURE_CANCELLED')).toBe(EVENT_CAPTURE_CANCELLED);
    expect(lit('EVENT_OVERLAY_MODE')).toBe(EVENT_OVERLAY_MODE);
  });
});
