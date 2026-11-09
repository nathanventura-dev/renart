import { DEFAULT_ZOOM_MODE, type ZoomMode } from '../utils/zoomMode';

export const ZOOM_MODE_STORAGE_KEY = 'renart-zoom-mode';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ZoomEnv {
  storage?: StorageLike;
}

function isZoomMode(v: unknown): v is ZoomMode {
  return v === 'auto' || v === 'manual';
}

function defaultEnv(): ZoomEnv {
  if (typeof window === 'undefined') return {};
  try {
    return { storage: window.localStorage };
  } catch {
    return {};
  }
}

/**
 * Estado do zoom do editor: o modo (automático ou manual) é uma preferência salva;
 * o zoom manual de cada captura e o aviso de primeira vez vivem só na sessão.
 */
export function createZoomStore(env: ZoomEnv = defaultEnv()) {
  const listeners = new Set<() => void>();
  const manualZooms = new Map<string, number>();
  let noticeShown = false;

  function readStoredMode(): ZoomMode {
    try {
      const raw = env.storage?.getItem(ZOOM_MODE_STORAGE_KEY);
      return isZoomMode(raw) ? raw : DEFAULT_ZOOM_MODE;
    } catch {
      return DEFAULT_ZOOM_MODE;
    }
  }

  let mode: ZoomMode = readStoredMode();

  return {
    getMode: (): ZoomMode => mode,

    setMode: (next: ZoomMode) => {
      if (next === mode) return;
      mode = next;
      try {
        env.storage?.setItem(ZOOM_MODE_STORAGE_KEY, next);
      } catch {
        // Storage indisponível: o modo continua valendo em memória.
      }
      listeners.forEach((l) => l());
    },

    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    saveManualZoom: (captureId: string, zoom: number) => {
      manualZooms.set(captureId, zoom);
    },
    getManualZoom: (captureId: string): number | undefined => manualZooms.get(captureId),
    removeManualZoom: (captureId: string) => {
      manualZooms.delete(captureId);
    },

    hasShownManualNotice: (): boolean => noticeShown,
    markManualNoticeShown: () => {
      noticeShown = true;
    },
  };
}

export type ZoomStore = ReturnType<typeof createZoomStore>;

export const zoomStore: ZoomStore = createZoomStore();
