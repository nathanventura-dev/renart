import type { OverlayMode } from '../utils/overlayParams';

/** Nomes idênticos aos de src-tauri/src/capture_session.rs. */
export const EVENT_CAPTURE_COMPLETE = 'capture-complete';
export const EVENT_CAPTURE_CANCELLED = 'capture-cancelled';
export const EVENT_OVERLAY_MODE = 'overlay-mode-changed';
export const EVENT_ACTIVE_MONITOR = 'overlay-active-monitor';
export const EVENT_HOVER_WINDOW = 'overlay-hover-window';
export const DENIED_ERROR = 'screen-recording-denied';

export type CaptureSelection =
  | { kind: 'fullscreen' }
  | { kind: 'region'; x: number; y: number; width: number; height: number }
  | { kind: 'window'; id: number };

export interface CaptureResult {
  dataUrl: string;
  fullscreen: boolean;
  kind?: 'region' | 'fullscreen' | 'window';
}

/** Janela sob o cursor, com o retângulo (local) de cada monitor que ela toca; `id` nulo = nenhuma janela. */
export interface HoverWindow {
  id: number | null;
  appName: string;
  title: string;
  rects: { monitorId: number; x: number; y: number; width: number; height: number }[];
}

export interface ServiceDeps {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  listen?: <T>(event: string, handler: (payload: T) => void) => Promise<() => void>;
  isTauri?: boolean;
  createObjectUrl?: (blob: Blob) => string;
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

/** Pede o quadro do monitor como BMP cru (bytes binários) e devolve uma URL de objeto para exibi-lo. */
export async function getOverlayFrame(id: number, deps: ServiceDeps = {}): Promise<string> {
  const data = await call<ArrayBuffer | Uint8Array | number[]>('get_overlay_frame', { id }, deps);
  const part = Array.isArray(data) ? new Uint8Array(data) : data;
  const blob = new Blob([part as BlobPart], { type: 'image/bmp' });
  return (deps.createObjectUrl ?? ((b: Blob) => URL.createObjectURL(b)))(blob);
}

/** Avisa o Rust que o quadro já foi decodificado: só então a janela do overlay aparece. */
export const overlayReady = (id: number, deps: ServiceDeps = {}) => call<void>('overlay_ready', { id }, deps);

export const finishCapture = (id: number, selection: CaptureSelection, deps: ServiceDeps = {}) =>
  call<void>('finish_capture', { id, selection }, deps);

export const cancelCapture = (deps: ServiceDeps = {}) => call<void>('cancel_capture', undefined, deps);

export const setOverlayMode = (mode: OverlayMode, deps: ServiceDeps = {}) =>
  call<void>('set_overlay_mode', { mode }, deps);

export interface UiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Informa ao Rust onde fica a barra de opções do overlay (o Rust não força a mira por cima dela). */
export const setOverlayUiRect = (id: number, rect: UiRect, deps: ServiceDeps = {}) =>
  call<void>('set_overlay_ui_rect', { id, rect }, deps);

export const onCaptureComplete = (cb: (r: CaptureResult) => void, deps: ServiceDeps = {}) =>
  subscribe<CaptureResult>(EVENT_CAPTURE_COMPLETE, cb, deps);

export const onCaptureCancelled = (cb: () => void, deps: ServiceDeps = {}) =>
  subscribe<unknown>(EVENT_CAPTURE_CANCELLED, () => cb(), deps);

export const onActiveMonitorChanged = (cb: (id: number) => void, deps: ServiceDeps = {}) =>
  subscribe<{ id: number }>(EVENT_ACTIVE_MONITOR, (payload) => cb(payload.id), deps);

export const onHoverWindowChanged = (cb: (hover: HoverWindow) => void, deps: ServiceDeps = {}) =>
  subscribe<HoverWindow>(EVENT_HOVER_WINDOW, cb, deps);

export const onOverlayModeChanged = (cb: (mode: OverlayMode) => void, deps: ServiceDeps = {}) =>
  subscribe<OverlayMode>(EVENT_OVERLAY_MODE, cb, deps);

/** Pede foco para a janela atual (overlays de monitores diferentes disputam o foco do teclado). */
export async function focusThisWindow(deps: ServiceDeps = {}): Promise<void> {
  if (!(deps.isTauri ?? isTauri())) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFocus();
  } catch {
    /* sem permissão ou janela já fechada: ignora */
  }
}

/** Mensagem amigável para um erro de `beginCapture`. */
export function describeCaptureError(err: unknown): string {
  const text = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (text.includes(DENIED_ERROR)) {
    return 'Permissão de Gravação de Tela negada. Libere em Ajustes do Sistema → Privacidade e Segurança → Gravação de Tela e reabra o RenArt.';
  }
  return 'Não foi possível iniciar a captura.';
}
