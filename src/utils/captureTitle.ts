/** Título da nova captura na galeria: "Captura #N" ou "Tela Inteira #N", com N = tamanho atual + 1. */
export function captureTitle(fullscreen: boolean, count: number): string {
  return `${fullscreen ? 'Tela Inteira' : 'Captura'} #${count + 1}`;
}
