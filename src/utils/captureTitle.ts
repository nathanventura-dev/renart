export type CaptureKind = 'region' | 'fullscreen' | 'window';

const PREFIX: Record<CaptureKind, string> = {
  region: 'Captura',
  fullscreen: 'Tela Inteira',
  window: 'Janela',
};

/** Título da nova captura na galeria: "Captura #N", "Tela Inteira #N" ou "Janela #N", com N = tamanho atual + 1. */
export function captureTitle(kind: CaptureKind, count: number): string {
  return `${PREFIX[kind]} #${count + 1}`;
}
