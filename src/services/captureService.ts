import type { OverlayMode } from '../utils/overlayParams';

/** Nomes idênticos aos de src-tauri/src/capture_session.rs. */
export const EVENT_CAPTURE_COMPLETE = 'capture-complete';
export const EVENT_CAPTURE_CANCELLED = 'capture-cancelled';
export const EVENT_OVERLAY_MODE = 'overlay-mode-changed';
export const DENIED_ERROR = 'screen-recording-denied';

export type CaptureSelection =
  | { kind: 'fullscreen' }
  | { kind: 'region'; x: number; y: number; width: number; height: number };

export interface CaptureResult {
  dataUrl: string;
  fullscreen: boolean;
}

export interface ServiceDeps {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  listen?: <T>(event: string, handler: (payload: T) => void) => Promise<() => void>;
  isTauri?: boolean;
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

const defaultInvoke: NonNullable<ServiceDeps['invoke']> = async (cmd, args) => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke(cmd, args);
};

const defaultListen: NonNullable<ServiceDeps['listen']> = async (event, handler) => {
  const { listen } = await import('@tauri-apps/api/event');
  return listen(event, (e) => handler(e.payload as never));
};

async function call<T>(cmd: string, args: Record<string, unknown> | undefined, deps: ServiceDeps): Promise<T> {
  if (!(deps.isTauri ?? isTauri())) throw new Error('capture-unavailable');
  return (await (deps.invoke ?? defaultInvoke)(cmd, args)) as T;
}

async function subscribe<T>(
  event: string,
  cb: (payload: T) => void,
  deps: ServiceDeps
): Promise<() => void> {
  if (!(deps.isTauri ?? isTauri())) return () => {};
  try {
    return await (deps.listen ?? defaultListen)<T>(event, cb);
  } catch (err) {
    console.warn(`Não foi possível assinar o evento ${event}:`, err);
    return () => {};
  }
}

export const beginCapture = (mode: OverlayMode, deps: ServiceDeps = {}) =>
  call<void>('begin_capture', { mode }, deps);

export const getOverlayFrame = (id: number, deps: ServiceDeps = {}) =>
  call<string>('get_overlay_frame', { id }, deps);

export const finishCapture = (id: number, selection: CaptureSelection, deps: ServiceDeps = {}) =>
  call<void>('finish_capture', { id, selection }, deps);

export const cancelCapture = (deps: ServiceDeps = {}) => call<void>('cancel_capture', undefined, deps);

export const setOverlayMode = (mode: OverlayMode, deps: ServiceDeps = {}) =>
  call<void>('set_overlay_mode', { mode }, deps);

export const onCaptureComplete = (cb: (r: CaptureResult) => void, deps: ServiceDeps = {}) =>
  subscribe<CaptureResult>(EVENT_CAPTURE_COMPLETE, cb, deps);

export const onCaptureCancelled = (cb: () => void, deps: ServiceDeps = {}) =>
  subscribe<unknown>(EVENT_CAPTURE_CANCELLED, () => cb(), deps);

export const onOverlayModeChanged = (cb: (mode: OverlayMode) => void, deps: ServiceDeps = {}) =>
  subscribe<OverlayMode>(EVENT_OVERLAY_MODE, cb, deps);
