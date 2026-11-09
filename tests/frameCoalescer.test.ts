import { describe, it, expect } from 'vitest';
import { createFrameCoalescer } from '../src/utils/frameCoalescer';

function fakeFrames() {
  let nextId = 1;
  const pending = new Map<number, () => void>();
  return {
    requestFrame: (cb: () => void) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => void pending.delete(id),
    flush: () => {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((cb) => cb());
    },
    pendingCount: () => pending.size,
  };
}

describe('frameCoalescer', () => {
  it('várias chamadas no mesmo quadro executam uma única vez', () => {
    const frames = fakeFrames();
    let runs = 0;
    const c = createFrameCoalescer(() => void runs++, frames.requestFrame, frames.cancelFrame);
    c.schedule();
    c.schedule();
    c.schedule();
    expect(frames.pendingCount()).toBe(1);
    frames.flush();
    expect(runs).toBe(1);
  });

  it('depois do quadro, uma nova chamada agenda de novo', () => {
    const frames = fakeFrames();
    let runs = 0;
    const c = createFrameCoalescer(() => void runs++, frames.requestFrame, frames.cancelFrame);
    c.schedule();
    frames.flush();
    c.schedule();
    frames.flush();
    expect(runs).toBe(2);
  });

  it('cancelar descarta a execução pendente', () => {
    const frames = fakeFrames();
    let runs = 0;
    const c = createFrameCoalescer(() => void runs++, frames.requestFrame, frames.cancelFrame);
    c.schedule();
    c.cancel();
    frames.flush();
    expect(runs).toBe(0);
  });

  it('cancelar sem nada pendente não lança', () => {
    const frames = fakeFrames();
    const c = createFrameCoalescer(() => {}, frames.requestFrame, frames.cancelFrame);
    expect(() => c.cancel()).not.toThrow();
  });
});
