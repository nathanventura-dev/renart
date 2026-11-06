/** Evento emitido pelo Rust (src-tauri/src/shortcuts.rs) quando o atalho global de captura é acionado. */
export const CAPTURE_SHORTCUT_EVENT = 'global-capture-shortcut';

export type ListenFn = (event: string, handler: () => void) => Promise<() => void>;

export interface ShortcutEnv {
  isTauri?: boolean;
  listen?: ListenFn;
}

function detectTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

const defaultListen: ListenFn = async (event, handler) => {
  const { listen } = await import('@tauri-apps/api/event');
  return listen(event, () => handler());
};

/**
 * Assina o atalho global de captura. Fora do Tauri (modo navegador) não faz nada.
 * Retorna a função que cancela a assinatura; nunca lança.
 */
export async function listenForCaptureShortcut(
  onTrigger: () => void,
  env: ShortcutEnv = {}
): Promise<() => void> {
  const isTauri = env.isTauri ?? detectTauri();
  if (!isTauri) return () => {};
  try {
    const unlisten = await (env.listen ?? defaultListen)(CAPTURE_SHORTCUT_EVENT, onTrigger);
    return unlisten;
  } catch (err) {
    console.warn('Não foi possível assinar o atalho global de captura:', err);
    return () => {};
  }
}
