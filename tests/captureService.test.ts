import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  EVENT_ACTIVE_MONITOR,
  EVENT_CAPTURE_CANCELLED,
  EVENT_CAPTURE_COMPLETE,
  EVENT_CAPTURE_ERROR,
  EVENT_HOVER_WINDOW,
  EVENT_OVERLAY_MODE,
  beginCapture,
  cancelCapture,
  finishCapture,
  getOverlayFrame,
  getWindowImage,
  parseWindowImage,
  onActiveMonitorChanged,
  onCaptureCancelled,
  overlayReady,
  onCaptureComplete,
  onCaptureError,
  onHoverWindowChanged,
  onOverlayModeChanged,
  setOverlayMode,
  setOverlayUiRect,
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

  it('getOverlayFrame returns an object URL for the raw BMP bytes, with no base64 involved', async () => {
    const env = fakeEnv();
    const bytes = new Uint8Array([66, 77, 1, 2, 3]).buffer;
    env.invoke.mockResolvedValueOnce(bytes);
    const createObjectUrl = vi.fn((_blob: Blob) => 'blob:frame-4');
    const url = await getOverlayFrame(4, { ...env, isTauri: true, createObjectUrl });
    expect(env.invoke).toHaveBeenCalledWith('get_overlay_frame', { id: 4 });
    expect(url).toBe('blob:frame-4');
    const blob = createObjectUrl.mock.calls[0][0];
    expect(blob.type).toBe('image/bmp');
    expect(blob.size).toBe(5);
  });

  it('overlayReady, cancelCapture and setOverlayMode call the matching commands', async () => {
    const env = fakeEnv();
    await overlayReady(4, { ...env, isTauri: true });
    await cancelCapture({ ...env, isTauri: true });
    await setOverlayMode('fullscreen', { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('overlay_ready', { id: 4 });
    expect(env.invoke).toHaveBeenCalledWith('cancel_capture', undefined);
    expect(env.invoke).toHaveBeenCalledWith('set_overlay_mode', { mode: 'fullscreen' });
  });

  it('setOverlayUiRect sends the options bar rectangle to Rust', async () => {
    const env = fakeEnv();
    const rect = { x: 10, y: 20, width: 300, height: 40 };
    await setOverlayUiRect(2, rect, { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('set_overlay_ui_rect', { id: 2, rect });
  });

  it('finishCapture accepts a window selection', async () => {
    const env = fakeEnv();
    await finishCapture(2, { kind: 'window', id: 77 }, { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('finish_capture', { id: 2, selection: { kind: 'window', id: 77 } });
  });

  it('onHoverWindowChanged forwards the window under the cursor with its per-monitor rectangles', async () => {
    const env = fakeEnv();
    const cb = vi.fn();
    await onHoverWindowChanged(cb, { ...env, isTauri: true });
    const hover = { id: 9, appName: 'Safari', title: 'Aba', rects: [{ monitorId: 1, x: 1, y: 2, width: 3, height: 4 }] };
    env.handlers[EVENT_HOVER_WINDOW](hover);
    expect(cb).toHaveBeenCalledWith(hover);
  });

  it('onCaptureComplete forwards the capture kind', async () => {
    const env = fakeEnv();
    const cb = vi.fn();
    await onCaptureComplete(cb, { ...env, isTauri: true });
    env.handlers[EVENT_CAPTURE_COMPLETE]({ dataUrl: 'data:image/png;base64,AAA', fullscreen: false, kind: 'window' });
    expect(cb).toHaveBeenCalledWith({ dataUrl: 'data:image/png;base64,AAA', fullscreen: false, kind: 'window' });
  });

  it('onCaptureError subscribes to capture-error and forwards the error code', async () => {
    const env = fakeEnv();
    const cb = vi.fn();
    await onCaptureError(cb, { ...env, isTauri: true });
    env.handlers[EVENT_CAPTURE_ERROR]('screen-recording-denied');
    expect(cb).toHaveBeenCalledWith('screen-recording-denied');
  });

  it('onActiveMonitorChanged forwards the id of the monitor under the cursor', async () => {
    const env = fakeEnv();
    const cb = vi.fn();
    await onActiveMonitorChanged(cb, { ...env, isTauri: true });
    env.handlers[EVENT_ACTIVE_MONITOR]({ id: 7 });
    expect(cb).toHaveBeenCalledWith(7);
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

describe('window image preview', () => {
  const blob = (w: number, h: number, pixels: number[]) => {
    const buf = new Uint8Array(8 + pixels.length);
    new DataView(buf.buffer).setUint32(0, w, true);
    new DataView(buf.buffer).setUint32(4, h, true);
    buf.set(pixels, 8);
    return buf.buffer;
  };

  it('parseWindowImage reads the size header and exposes the RGBA pixels', () => {
    const img = parseWindowImage(blob(2, 1, [255, 0, 0, 128, 0, 255, 0, 255]));
    expect([img.width, img.height]).toEqual([2, 1]);
    expect(Array.from(img.pixels)).toEqual([255, 0, 0, 128, 0, 255, 0, 255]);
  });

  it('parseWindowImage rejects a buffer whose size does not match the header', () => {
    expect(() => parseWindowImage(blob(2, 2, [1, 2, 3, 4]))).toThrow();
    expect(() => parseWindowImage(new Uint8Array([1, 2, 3]).buffer)).toThrow();
  });

  it('getWindowImage invokes get_window_image and parses the response', async () => {
    const env = fakeEnv();
    env.invoke.mockResolvedValueOnce(blob(1, 1, [9, 8, 7, 6]));
    const img = await getWindowImage(5, { ...env, isTauri: true });
    expect(env.invoke).toHaveBeenCalledWith('get_window_image', { id: 5 });
    expect(Array.from(img.pixels)).toEqual([9, 8, 7, 6]);
  });
});

describe('captureService (browser)', () => {
  it('rejects commands with capture-unavailable and never subscribes', async () => {
    const env = fakeEnv();
    await expect(beginCapture('region', { ...env, isTauri: false })).rejects.toThrow('capture-unavailable');
    await expect(cancelCapture({ ...env, isTauri: false })).rejects.toThrow('capture-unavailable');
    const stop = await onCaptureComplete(() => {}, { ...env, isTauri: false });
    await onCaptureError(() => {}, { ...env, isTauri: false });
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
    expect(lit('EVENT_ACTIVE_MONITOR')).toBe(EVENT_ACTIVE_MONITOR);
    expect(lit('EVENT_HOVER_WINDOW')).toBe(EVENT_HOVER_WINDOW);
    expect(lit('EVENT_CAPTURE_ERROR')).toBe(EVENT_CAPTURE_ERROR);
  });
});
