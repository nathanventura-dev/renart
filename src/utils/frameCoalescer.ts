/**
 * Agrupa várias chamadas no mesmo quadro em uma única execução de `run`.
 * `requestFrame` e `cancelFrame` são injetáveis para teste (padrão: requestAnimationFrame).
 */
export function createFrameCoalescer(
  run: () => void,
  requestFrame: (cb: () => void) => number = (cb) => requestAnimationFrame(cb),
  cancelFrame: (id: number) => void = (id) => cancelAnimationFrame(id)
): { schedule: () => void; cancel: () => void } {
  let pendingId: number | null = null;

  return {
    schedule: () => {
      if (pendingId !== null) return;
      pendingId = requestFrame(() => {
        pendingId = null;
        run();
      });
    },
    cancel: () => {
      if (pendingId === null) return;
      cancelFrame(pendingId);
      pendingId = null;
    },
  };
}
