export type OverlayMode = 'region' | 'fullscreen' | 'window';

export interface OverlayParams {
  monitorId: number;
  mode: OverlayMode;
}

/** Lê `?overlay=<id>&mode=<region|fullscreen|window>`; devolve `null` quando a janela não é um overlay. */
export function parseOverlayParams(search: string): OverlayParams | null {
  const params = new URLSearchParams(search);
  const rawId = params.get('overlay');
  const mode = params.get('mode');
  if (rawId === null || !/^\d+$/.test(rawId)) return null;
  if (mode !== 'region' && mode !== 'fullscreen' && mode !== 'window') return null;
  return { monitorId: Number(rawId), mode };
}
